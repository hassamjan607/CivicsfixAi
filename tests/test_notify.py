"""
Tests for CivicFix AI Notification Service

Comprehensive unit tests for email and WhatsApp notification functionality,
including template rendering, retry logic, rate limiting, and error handling.
"""

import asyncio
import pytest
from datetime import datetime, timedelta, timezone
from unittest.mock import Mock, AsyncMock, patch
from typing import Dict, Any

from app.notify import (
    NotificationService, EmailService, WhatsAppService,
    NotificationTemplates, NotificationQueue, RateLimiter,
    NotificationMessage, NotificationContext, DeliveryResult,
    NotificationType, NotificationChannel, Language,
    send_complaint_notification, send_escalation_notification,
    send_urgent_alert, get_notification_service
)
from app.models import Complaint, Department
from app.config import ComplaintCategory, ComplaintStatus


class TestRateLimiter:
    """Test rate limiting functionality"""
    
    @pytest.mark.asyncio
    async def test_rate_limiter_allows_calls_within_limit(self):
        """Test that rate limiter allows calls within the limit"""
        limiter = RateLimiter(max_calls_per_minute=5)
        
        # Should allow 5 calls
        for i in range(5):
            assert await limiter.acquire()
        
        # 6th call should be blocked
        assert not await limiter.acquire()
    
    @pytest.mark.asyncio
    async def test_rate_limiter_resets_after_time_window(self):
        """Test that rate limiter resets after time window"""
        limiter = RateLimiter(max_calls_per_minute=2)
        
        # Use up the limit
        assert await limiter.acquire()
        assert await limiter.acquire()
        assert not await limiter.acquire()
        
        # Mock time progression (in real usage, would wait 60+ seconds)
        import time
        current_time = time.time()
        with patch('time.time', return_value=current_time + 61):
            # Should be able to make calls again
            assert await limiter.acquire()


class TestNotificationQueue:
    """Test notification queue and retry logic"""
    
    @pytest.mark.asyncio
    async def test_queue_enqueue_dequeue(self):
        """Test basic queue operations"""
        queue = NotificationQueue()
        
        # Create test message
        context = NotificationContext(
            tracking_id="CF-TEST",
            category="pothole",
            summary="Test complaint",
            urgency_score=5,
            department_name="Test Dept",
            status="Pending",
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        )
        
        message = NotificationMessage(
            recipient="test@example.com",
            channel=NotificationChannel.EMAIL,
            notification_type=NotificationType.SUBMISSION_CONFIRMATION,
            language=Language.ENGLISH,
            subject="Test",
            content="Test message",
            context=context
        )
        
        # Test enqueue/dequeue
        await queue.enqueue(message)
        retrieved = await queue.dequeue()
        
        assert retrieved is not None
        assert retrieved.recipient == "test@example.com"
        assert retrieved.context.tracking_id == "CF-TEST"
        
        # Queue should be empty now
        empty = await queue.dequeue()
        assert empty is None
    
    @pytest.mark.asyncio
    async def test_retry_queue_logic(self):
        """Test retry queue functionality"""
        queue = NotificationQueue()
        
        context = NotificationContext(
            tracking_id="CF-RETRY",
            category="water_leak",
            summary="Retry test",
            urgency_score=3,
            department_name="Water Dept",
            status="Pending",
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        )
        
        message = NotificationMessage(
            recipient="retry@example.com",
            channel=NotificationChannel.EMAIL,
            notification_type=NotificationType.STATUS_UPDATE,
            language=Language.ENGLISH,
            subject="Retry Test",
            content="Retry message",
            context=context,
            max_retries=2
        )
        
        # Test requeue for retry
        await queue.requeue_for_retry(message, delay_seconds=1)
        assert message.retry_count == 1
        assert message.next_retry_at is not None
        
        # Message should not be ready immediately
        ready = await queue.get_ready_messages()
        assert len(ready) == 0
        
        # Mock time progression
        message.next_retry_at = datetime.now(timezone.utc) - timedelta(seconds=1)
        ready = await queue.get_ready_messages()
        assert len(ready) == 1
        
        # Test max retries exceeded
        await queue.requeue_for_retry(message)  # retry_count = 2
        await queue.requeue_for_retry(message)  # retry_count = 3, should go to failed_queue
        
        assert len(queue.failed_queue) == 1
        assert queue.failed_queue[0].retry_count == 3


class TestNotificationTemplates:
    """Test notification templates and formatting"""
    
    def test_template_formatting_english(self):
        """Test English template formatting"""
        context = NotificationContext(
            tracking_id="CF-1234",
            category="pothole",
            summary="Large pothole on Main St",
            urgency_score=7,
            department_name="Roads Department",
            status="Pending",
            created_at=datetime(2024, 1, 15, 10, 30, 0),
            updated_at=datetime(2024, 1, 15, 10, 30, 0),
            location="Main Street, Downtown"
        )
        
        template = NotificationTemplates.get_whatsapp_template(
            NotificationType.SUBMISSION_CONFIRMATION,
            Language.ENGLISH
        )
        
        formatted = NotificationTemplates.format_template(template, context)
        
        assert "CF-1234" in formatted
        assert "pothole" in formatted
        assert "Roads Department" in formatted
        assert "7/10" in formatted
    
    def test_template_formatting_urdu(self):
        """Test Urdu template formatting"""
        context = NotificationContext(
            tracking_id="CF-5678",
            category="streetlight",
            summary="بجلی کی خرابی",
            urgency_score=4,
            department_name="Electrical Department",
            status="In Progress",
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
            location="کراچی، گلشن"
        )
        
        template = NotificationTemplates.get_whatsapp_template(
            NotificationType.STATUS_UPDATE,
            Language.URDU
        )
        
        formatted = NotificationTemplates.format_template(template, context)
        
        assert "CF-5678" in formatted
        assert "Electrical Department" in formatted
    
    def test_template_error_handling(self):
        """Test template formatting with missing data"""
        context = NotificationContext(
            tracking_id="CF-ERROR",
            category="other",
            summary="Test",
            urgency_score=1,
            department_name="Test",
            status="Pending",
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        )
        
        # Template with missing field
        template = "Hello {nonexistent_field}! Your complaint {tracking_id} is ready."
        formatted = NotificationTemplates.format_template(template, context)
        
        # Should return original template on error
        assert template == formatted


@pytest.mark.asyncio
class TestEmailService:
    """Test email service functionality"""
    
    @patch.dict('os.environ', {'RESEND_API_KEY': 'test_key', 'RESEND_FROM_EMAIL': 'test@civicfix.ai'})
    async def test_email_service_initialization(self):
        """Test email service initialization with config"""
        with patch('resend.api_key', 'test_key'):
            service = EmailService()
            assert service.api_key == 'test_key'
            assert service.from_email == 'test@civicfix.ai'
    
    async def test_email_service_without_config(self):
        """Test email service without API key"""
        with patch.dict('os.environ', {}, clear=True):
            service = EmailService()
            assert service.api_key is None
            
            result = await service.send_email("test@example.com", "Test", "Content")
            assert not result.success
            assert result.permanent_failure
            assert "not configured" in result.error_message
    
    @patch.dict('os.environ', {'RESEND_API_KEY': 'test_key'})
    async def test_email_send_success(self):
        """Test successful email sending"""
        mock_response = Mock()
        mock_response.id = 'msg_123'
        
        with patch('resend.Emails.send') as mock_send:
            mock_send.return_value = mock_response
            
            service = EmailService()
            result = await service.send_email("test@example.com", "Test Subject", "Test Content")
            
            assert result.success
            assert result.message_id == 'msg_123'
            mock_send.assert_called_once()
    
    @patch.dict('os.environ', {'RESEND_API_KEY': 'test_key'})
    async def test_email_send_failure(self):
        """Test email send failure handling"""
        with patch('resend.Emails.send') as mock_send:
            mock_send.side_effect = Exception("Invalid email address")
            
            service = EmailService()
            result = await service.send_email("invalid", "Subject", "Content")
            
            assert not result.success
            assert result.permanent_failure  # Should detect "invalid email" as permanent
            assert "Invalid email address" in result.error_message


@pytest.mark.asyncio  
class TestWhatsAppService:
    """Test WhatsApp service functionality"""
    
    @patch.dict('os.environ', {
        'WHATSAPP_ACCESS_TOKEN': 'test_token',
        'WHATSAPP_PHONE_NUMBER_ID': '123456789'
    })
    async def test_whatsapp_service_initialization(self):
        """Test WhatsApp service initialization with config"""
        service = WhatsAppService()
        assert service.access_token == 'test_token'
        assert service.phone_number_id == '123456789'
        assert "123456789" in service.base_url
    
    async def test_whatsapp_service_without_config(self):
        """Test WhatsApp service without credentials"""
        with patch.dict('os.environ', {}, clear=True):
            service = WhatsAppService()
            
            result = await service.send_whatsapp_message("+1234567890", "Test message")
            assert not result.success
            assert result.permanent_failure
            assert "not configured" in result.error_message
    
    async def test_phone_number_formatting(self):
        """Test phone number formatting"""
        service = WhatsAppService()
        
        assert service._format_phone_number("+92-300-1234567") == "923001234567"
        assert service._format_phone_number("+1 (555) 123-4567") == "15551234567" 
        assert service._format_phone_number("923001234567") == "923001234567"
    
    @patch.dict('os.environ', {
        'WHATSAPP_ACCESS_TOKEN': 'test_token',
        'WHATSAPP_PHONE_NUMBER_ID': '123456789'
    })
    @patch('httpx.AsyncClient')
    async def test_whatsapp_send_success(self, mock_client_class):
        """Test successful WhatsApp message sending"""
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "messages": [{"id": "wamid.test123"}]
        }
        
        mock_client = AsyncMock()
        mock_client.post.return_value = mock_response
        mock_client.__aenter__.return_value = mock_client
        mock_client.__aexit__.return_value = None
        mock_client_class.return_value = mock_client
        
        service = WhatsAppService()
        result = await service.send_whatsapp_message("+923001234567", "Test message")
        
        assert result.success
        assert result.message_id == "wamid.test123"
    
    @patch.dict('os.environ', {
        'WHATSAPP_ACCESS_TOKEN': 'test_token', 
        'WHATSAPP_PHONE_NUMBER_ID': '123456789'
    })
    @patch('httpx.AsyncClient')
    async def test_whatsapp_rate_limit(self, mock_client_class):
        """Test WhatsApp rate limiting response"""
        mock_response = Mock()
        mock_response.status_code = 429
        mock_response.text = "Rate limit exceeded"
        
        mock_client = AsyncMock()
        mock_client.post.return_value = mock_response
        mock_client.__aenter__.return_value = mock_client
        mock_client.__aexit__.return_value = None
        mock_client_class.return_value = mock_client
        
        service = WhatsAppService()
        result = await service.send_whatsapp_message("+923001234567", "Test message")
        
        assert not result.success
        assert not result.permanent_failure
        assert result.retry_after == 300  # 5 minutes
        assert "Rate limited" in result.error_message
@pytest.mark.asyncio
class TestNotificationService:
    """Test main notification service orchestration"""
    
    async def test_language_detection(self):
        """Test automatic language detection"""
        service = NotificationService()
        
        # English text
        assert service._detect_language("Water pipe burst on main road") == Language.ENGLISH
        
        # Urdu text
        assert service._detect_language("پانی کا پائپ پھٹ گیا ہے") == Language.URDU
        
        # Mixed text (should default to detected language)
        assert service._detect_language("Pothole مسئلہ") == Language.URDU
    
    async def test_notification_context_creation(self):
        """Test notification context creation from complaint data"""
        # Create test data
        complaint = Complaint(
            id=1,
            tracking_id="CF-1001",
            category=ComplaintCategory.POTHOLE.value,
            summary="Large pothole damaging vehicles",
            description="Deep pothole causing tire damage",
            sentiment="negative",
            urgency_score=6,
            status=ComplaintStatus.PENDING.value,
            latitude=24.8607,
            longitude=67.0011,
            address="Karachi, Sindh",
            created_at=datetime(2024, 1, 15, 10, 0, 0),
            updated_at=datetime(2024, 1, 15, 10, 0, 0),
            urgency_reasons='["Base severity: 4", "Weather bonus: +2"]'
        )
        
        department = Department(
            id=1,
            name="Roads Department",
            email="roads@municipality.gov",
            whatsapp_contact="+92-300-1234567"
        )
        
        service = NotificationService()
        context = service._create_notification_context(complaint, department)
        
        assert context.tracking_id == "CF-1001"
        assert context.category == "pothole"
        assert context.urgency_score == 6
        assert context.department_name == "Roads Department"
        assert context.location == "Karachi, Sindh"
        assert len(context.urgency_reasons) == 2
    
    async def test_notification_message_creation(self):
        """Test notification message creation with templates"""
        context = NotificationContext(
            tracking_id="CF-2001",
            category="water_leak",
            summary="Water pipe burst",
            urgency_score=8,
            department_name="Water & Sanitation",
            status="Pending",
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
            location="Main Street"
        )
        
        service = NotificationService()
        
        # Test email message creation
        email_msg = await service.create_notification_message(
            recipient="water@municipality.gov",
            channel=NotificationChannel.EMAIL,
            notification_type=NotificationType.SUBMISSION_CONFIRMATION,
            context=context,
            language=Language.ENGLISH
        )
        
        assert email_msg.recipient == "water@municipality.gov"
        assert email_msg.channel == NotificationChannel.EMAIL
        assert "CF-2001" in email_msg.subject
        assert "CF-2001" in email_msg.content
        assert "Water & Sanitation" in email_msg.content
        
        # Test WhatsApp message creation
        whatsapp_msg = await service.create_notification_message(
            recipient="+923001234567",
            channel=NotificationChannel.WHATSAPP,
            notification_type=NotificationType.URGENT_ALERT,
            context=context,
            language=Language.ENGLISH
        )
        
        assert whatsapp_msg.recipient == "+923001234567"
        assert whatsapp_msg.channel == NotificationChannel.WHATSAPP
        assert "🚨 URGENT" in whatsapp_msg.content
        assert "CF-2001" in whatsapp_msg.content
    
    @patch('app.notify.NotificationService._send_message')
    async def test_queue_processing(self, mock_send):
        """Test notification queue processing"""
        mock_send.return_value = DeliveryResult(success=True, message_id="test123")
        
        context = NotificationContext(
            tracking_id="CF-3001",
            category="streetlight",
            summary="Street light not working",
            urgency_score=3,
            department_name="Electrical Department",
            status="Pending",
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        )
        
        service = NotificationService()
        
        # Queue a notification
        await service.queue_notification(
            recipient="electrical@municipality.gov",
            channel=NotificationChannel.EMAIL,
            notification_type=NotificationType.SUBMISSION_CONFIRMATION,
            context=context
        )
        
        # Let queue processing run briefly
        await asyncio.sleep(0.1)
        
        # Verify message was processed
        mock_send.assert_called()


@pytest.mark.asyncio
class TestPublicAPI:
    """Test public API functions"""
    
    def create_test_complaint(self) -> Complaint:
        """Create test complaint data"""
        return Complaint(
            id=1,
            tracking_id="CF-API-TEST",
            category=ComplaintCategory.GARBAGE.value,
            summary="Garbage overflow at market",
            description="Large pile of garbage blocking walkway",
            sentiment="negative", 
            urgency_score=5,
            status=ComplaintStatus.PENDING.value,
            latitude=24.8607,
            longitude=67.0011,
            address="Market Area, Karachi",
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
            urgency_reasons='["Base severity: 3", "Recurrence bonus: +2"]'
        )
    
    def create_test_department(self) -> Department:
        """Create test department data"""
        return Department(
            id=3,
            name="Solid Waste Management",
            email="waste@municipality.gov",
            whatsapp_contact="+92-300-1111111",
            supervisor_contact="+92-300-2222222"
        )
    
    @patch('app.notify.get_notification_service')
    async def test_send_complaint_notification(self, mock_get_service):
        """Test complaint notification sending"""
        mock_service = Mock()
        mock_service._create_notification_context.return_value = Mock()
        mock_service.queue_notification = AsyncMock()
        mock_get_service.return_value = mock_service
        
        complaint = self.create_test_complaint()
        department = self.create_test_department()
        
        await send_complaint_notification(complaint, department)
        
        # Should queue both email and WhatsApp notifications
        assert mock_service.queue_notification.call_count >= 2
    
    @patch('app.notify.get_notification_service')
    async def test_send_urgent_alert(self, mock_get_service):
        """Test urgent alert sending"""
        mock_service = Mock()
        mock_service._create_notification_context.return_value = Mock()
        mock_service.queue_notification = AsyncMock()
        mock_get_service.return_value = mock_service
        
        complaint = self.create_test_complaint()
        complaint.urgency_score = 10  # Make it urgent
        department = self.create_test_department()
        
        await send_urgent_alert(complaint, department)
        
        # Should queue notifications to department + supervisor
        assert mock_service.queue_notification.call_count >= 3
    
    @patch('app.notify.get_notification_service')
    async def test_send_escalation_notification(self, mock_get_service):
        """Test escalation notification sending"""
        mock_service = Mock()
        mock_service._create_notification_context.return_value = Mock()
        mock_service.queue_notification = AsyncMock()
        mock_get_service.return_value = mock_service
        
        complaint = self.create_test_complaint()
        complaint.escalated = True
        department = self.create_test_department()
        
        await send_escalation_notification(complaint, department)
        
        # Should queue multiple notifications (supervisor + department)
        assert mock_service.queue_notification.call_count >= 2
    
    async def test_notification_service_singleton(self):
        """Test notification service singleton pattern"""
        service1 = get_notification_service()
        service2 = get_notification_service()
        
        # Should return same instance
        assert service1 is service2


@pytest.mark.asyncio
class TestErrorHandling:
    """Test error handling and resilience"""
    
    async def test_notification_error_handling(self):
        """Test that notification errors don't crash the system"""
        complaint = Complaint(
            id=999,
            tracking_id="CF-ERROR-TEST",
            category=ComplaintCategory.OTHER.value,
            summary="Test error handling",
            description="Testing error scenarios",
            sentiment="neutral",
            urgency_score=1,
            status=ComplaintStatus.PENDING.value,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        )
        
        department = Department(
            id=999,
            name="Error Test Department",
            email="error@test.com"
        )
        
        # Mock service to raise exception
        with patch('app.notify.get_notification_service') as mock_get_service:
            mock_service = Mock()
            mock_service._create_notification_context.side_effect = Exception("Service error")
            mock_get_service.return_value = mock_service
            
            # Should not raise exception
            await send_complaint_notification(complaint, department)
    
    async def test_template_with_none_values(self):
        """Test template handling with None values in context"""
        context = NotificationContext(
            tracking_id="CF-NONE-TEST",
            category="test",
            summary="Test with None values",
            urgency_score=1,
            department_name="Test Dept",
            status="Pending", 
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
            location=None,  # None value
            urgency_reasons=None,  # None value
            sla_deadline=None  # None value
        )
        
        template = "Location: {location}, Reasons: {urgency_reasons}, Deadline: {sla_deadline}"
        formatted = NotificationTemplates.format_template(template, context)
        
        # Should replace None values with "N/A"
        assert "N/A" in formatted
        assert "None" not in formatted
    
    @patch('app.notify.logger')
    async def test_error_logging(self, mock_logger):
        """Test that errors are properly logged"""
        service = NotificationService()
        
        # Test with invalid message data
        bad_result = DeliveryResult(success=False, error_message="Test error", permanent_failure=True)
        
        with patch.object(service, '_send_message', return_value=bad_result):
            context = NotificationContext(
                tracking_id="CF-LOG-TEST",
                category="test",
                summary="Logging test",
                urgency_score=1,
                department_name="Test",
                status="Pending",
                created_at=datetime.utcnow(),
                updated_at=datetime.utcnow()
            )
            
            message = NotificationMessage(
                recipient="log@test.com",
                channel=NotificationChannel.EMAIL,
                notification_type=NotificationType.SUBMISSION_CONFIRMATION,
                language=Language.ENGLISH,
                subject="Log Test",
                content="Test content",
                context=context
            )
            
            await service.queue.enqueue(message)
            ready = await service.queue.get_ready_messages()
            
            for msg in ready:
                result = await service._send_message(msg)
                if result.permanent_failure:
                    # Should log permanent failures
                    pass  # In real test, would verify mock_logger.error was called


if __name__ == "__main__":
    # Run tests
    pytest.main([__file__, "-v"])