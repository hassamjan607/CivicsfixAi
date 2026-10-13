"""
CivicFix AI Notification Service

Email and WhatsApp notification service using Resend and WhatsApp Cloud API.
Handles complaint notifications, escalations, and retry logic with templates, 
localization, queuing, and comprehensive error handling.
"""

import asyncio
import json
import logging
import time
from datetime import datetime, timedelta, timezone
from enum import Enum
from typing import Dict, List, Optional, Tuple, Any
import os
from dataclasses import dataclass, asdict

import httpx
import resend

from .models import Complaint, Department
from .config import ComplaintCategory, ComplaintStatus

logger = logging.getLogger(__name__)


class NotificationType(str, Enum):
    """Notification message types"""
    SUBMISSION_CONFIRMATION = "submission_confirmation"
    STATUS_UPDATE = "status_update" 
    COMPLETION = "completion"
    URGENT_ALERT = "urgent_alert"
    ESCALATION = "escalation"
    REMINDER = "reminder"


class NotificationChannel(str, Enum):
    """Notification delivery channels"""
    EMAIL = "email"
    WHATSAPP = "whatsapp"
    SMS = "sms"  # Future extension


class Language(str, Enum):
    """Supported languages"""
    ENGLISH = "en"
    URDU = "ur"


@dataclass
class NotificationContext:
    """Context data for notification templates"""
    tracking_id: str
    category: str
    summary: str
    urgency_score: int
    department_name: str
    status: str
    created_at: datetime
    updated_at: datetime
    location: Optional[str] = None
    urgency_reasons: Optional[List[str]] = None
    escalation_reason: Optional[str] = None
    sla_deadline: Optional[datetime] = None
    days_overdue: Optional[int] = None

@dataclass
class NotificationMessage:
    """Notification message with metadata"""
    recipient: str
    channel: NotificationChannel
    notification_type: NotificationType
    language: Language
    subject: str
    content: str
    context: NotificationContext
    retry_count: int = 0
    max_retries: int = 3
    next_retry_at: Optional[datetime] = None
    created_at: datetime = None
    
    def __post_init__(self):
        if self.created_at is None:
            self.created_at = datetime.now(timezone.utc)


@dataclass
class DeliveryResult:
    """Result of notification delivery attempt"""
    success: bool
    message_id: Optional[str] = None
    error_message: Optional[str] = None
    retry_after: Optional[int] = None
    permanent_failure: bool = False


class RateLimiter:
    """Rate limiter for external API calls"""
    
    def __init__(self, max_calls_per_minute: int = 30):
        self.max_calls = max_calls_per_minute
        self.calls = []
        self.lock = asyncio.Lock()
    
    async def acquire(self) -> bool:
        """Acquire rate limit slot, returns True if allowed"""
        async with self.lock:
            now = time.time()
            # Remove calls older than 1 minute
            self.calls = [call_time for call_time in self.calls if now - call_time < 60]
            
            if len(self.calls) < self.max_calls:
                self.calls.append(now)
                return True
            return False
    
    async def wait_for_slot(self) -> None:
        """Wait until a rate limit slot becomes available"""
        while not await self.acquire():
            await asyncio.sleep(1)


class NotificationQueue:
    """In-memory notification queue with retry logic"""
    
    def __init__(self):
        self.queue: List[NotificationMessage] = []
        self.failed_queue: List[NotificationMessage] = []
        self.lock = asyncio.Lock()
    
    async def enqueue(self, message: NotificationMessage) -> None:
        """Add message to queue"""
        async with self.lock:
            self.queue.append(message)
    
    async def dequeue(self) -> Optional[NotificationMessage]:
        """Get next message from queue"""
        async with self.lock:
            if self.queue:
                return self.queue.pop(0)
            return None
    
    async def requeue_for_retry(self, message: NotificationMessage, delay_seconds: int = 60) -> None:
        """Requeue failed message for retry"""
        message.retry_count += 1
        message.next_retry_at = datetime.now(timezone.utc) + timedelta(seconds=delay_seconds)
        
        async with self.lock:
            if message.retry_count <= message.max_retries:
                self.queue.append(message)
            else:
                self.failed_queue.append(message)
                logger.error(f"Message permanently failed after {message.max_retries} retries: {message.context.tracking_id}")
    
    async def get_ready_messages(self) -> List[NotificationMessage]:
        """Get messages ready for delivery (retry time passed)"""
        now = datetime.now(timezone.utc)
        ready = []
        
        async with self.lock:
            remaining = []
            for msg in self.queue:
                if msg.next_retry_at is None:
                    ready.append(msg)
                else:
                    retry_at = msg.next_retry_at
                    if retry_at.tzinfo is None:
                        retry_at = retry_at.replace(tzinfo=timezone.utc)
                    if retry_at <= now:
                        ready.append(msg)
                    else:
                        remaining.append(msg)
            self.queue = remaining
        
        return ready

class NotificationTemplates:
    """Notification message templates with localization"""
    
    # Email templates in English and Urdu
    TEMPLATES = {
        # Submission Confirmation Templates
        NotificationType.SUBMISSION_CONFIRMATION: {
            Language.ENGLISH: {
                "subject": "Complaint Submitted Successfully - {tracking_id}",
                "content": """
Dear Citizen,

Thank you for reporting the issue to CivicFix AI.

Complaint Details:
- Tracking ID: {tracking_id}
- Category: {category}
- Description: {summary}
- Location: {location}
- Urgency Score: {urgency_score}/10
- Assigned Department: {department_name}
- Status: {status}

Expected Response Time: {sla_deadline}

You can track your complaint status anytime using the tracking ID.
We appreciate your contribution to improving our city's infrastructure.

Best regards,
CivicFix AI Team
"""
            },
            Language.URDU: {
                "subject": "شکایت کامیابی سے داخل کر دی گئی - {tracking_id}",
                "content": """
محترم شہری،

CivicFix AI میں مسئلہ رپورٹ کرنے کے لیے آپ کا شکریہ۔

شکایت کی تفصیلات:
- ٹریکنگ ID: {tracking_id}
- قسم: {category}
- تفصیل: {summary}
- مقام: {location}  
- فوری سطح: {urgency_score}/10
- تفویض شدہ شعبہ: {department_name}
- حالت: {status}

متوقع جوابی وقت: {sla_deadline}

آپ اپنی شکایت کی حالت کسی بھی وقت ٹریکنگ ID استعمال کرکے چیک کر سکتے ہیں۔
ہمارے شہر کی بنیادی ڈھانچے کو بہتر بنانے میں آپ کی شراکت کی تقدیر کرتے ہیں۔

نیک تمنائیں،
CivicFix AI ٹیم
"""
            }
        },
        
        # Status Update Templates
        NotificationType.STATUS_UPDATE: {
            Language.ENGLISH: {
                "subject": "Status Update for {tracking_id} - Now {status}",
                "content": """
Dear Citizen,

Your complaint status has been updated:

- Tracking ID: {tracking_id}
- Previous Status: Changed to {status}
- Updated: {updated_at}
- Department: {department_name}

{status} complaints typically resolve within the assigned timeframe.
You will receive another notification when work is completed.

Thank you for your patience.

Best regards,
CivicFix AI Team
"""
            },
            Language.URDU: {
                "subject": "{tracking_id} کی اپ ڈیٹ - اب {status}",
                "content": """
محترم شہری،

آپ کی شکایت کی حالت اپ ڈیٹ ہو گئی ہے:

- ٹریکنگ ID: {tracking_id}  
- پچھلی حالت: {status} میں تبدیل ہو گئی
- اپ ڈیٹ: {updated_at}
- شعبہ: {department_name}

{status} والی شکایات عام طور پر مقررہ وقت میں حل ہو جاتی ہیں۔
کام مکمل ہونے پر آپ کو دوسری اطلاع ملے گی۔

آپ کے صبر کا شکریہ۔

نیک تمنائیں،
CivicFix AI ٹیم  
"""
            }
        }
    }
    
    # WhatsApp templates (shorter format)
    WHATSAPP_TEMPLATES = {
        NotificationType.SUBMISSION_CONFIRMATION: {
            Language.ENGLISH: "✅ Complaint {tracking_id} submitted successfully!\n📋 {category}: {summary}\n🏢 Assigned to: {department_name}\n⚡ Urgency: {urgency_score}/10\n📍 Track at: civicfix.ai",
            Language.URDU: "✅ شکایت {tracking_id} کامیابی سے داخل!\n📋 {category}: {summary}\n🏢 تفویض: {department_name}\n⚡ اہمیت: {urgency_score}/10\n📍 ٹریک: civicfix.ai"
        },
        
        NotificationType.STATUS_UPDATE: {
            Language.ENGLISH: "📢 Update for {tracking_id}\n📋 Status changed to: {status}\n🏢 Department: {department_name}\n⏰ Updated: {updated_at}",
            Language.URDU: "📢 {tracking_id} کی اپڈیٹ\n📋 حالت: {status}\n🏢 شعبہ: {department_name}\n⏰ اپڈیٹ: {updated_at}"
        },
        
        NotificationType.URGENT_ALERT: {
            Language.ENGLISH: "🚨 URGENT: {tracking_id}\n⚡ High priority complaint assigned\n📋 {category}: {summary}\n📍 Location: {location}\n🏃‍♂️ Please respond ASAP",
            Language.URDU: "🚨 فوری: {tracking_id}\n⚡ اعلیٰ ترجیحی شکایت\n📋 {category}: {summary}\n📍 مقام: {location}\n🏃‍♂️ فوری جواب دیں"
        },
        
        NotificationType.ESCALATION: {
            Language.ENGLISH: "⚠️ ESCALATION: {tracking_id}\n📅 Overdue by {days_overdue} days\n📋 {category}: {summary}\n🏢 Department: {department_name}\n🔥 Requires immediate attention",
            Language.URDU: "⚠️ فوری توجہ: {tracking_id}\n📅 {days_overdue} دن سے التوا\n📋 {category}: {summary}\n🏢 شعبہ: {department_name}\n🔥 فوری توجہ درکار"
        }
    }
    
    @classmethod
    def get_email_template(cls, notification_type: NotificationType, language: Language) -> Dict[str, str]:
        """Get email template for notification type and language"""
        return cls.TEMPLATES.get(notification_type, {}).get(language, {})
    
    @classmethod
    def get_whatsapp_template(cls, notification_type: NotificationType, language: Language) -> str:
        """Get WhatsApp template for notification type and language"""
        return cls.WHATSAPP_TEMPLATES.get(notification_type, {}).get(language, "")
    
    @classmethod
    def format_template(cls, template: str, context: NotificationContext) -> str:
        """Format template with context data"""
        try:
            context_dict = asdict(context)
            # Format datetime objects
            for key, value in context_dict.items():
                if isinstance(value, datetime):
                    context_dict[key] = value.strftime("%Y-%m-%d %H:%M:%S")
                elif value is None:
                    context_dict[key] = "N/A"
            
            return template.format(**context_dict)
        except KeyError as e:
            logger.error(f"Template formatting error - missing key: {e}")
            return template
        except Exception as e:
            logger.error(f"Template formatting error: {e}")
            return template
class EmailService:
    """Email service using Resend API"""
    
    def __init__(self):
        self.api_key = os.getenv("RESEND_API_KEY")
        self.from_email = os.getenv("RESEND_FROM_EMAIL", "noreply@civicfix.ai")
        self.client = None
        self.rate_limiter = RateLimiter(max_calls_per_minute=100)  # Resend allows 100 emails/minute
        
        if self.api_key:
            # Store API key for direct API calls
            resend.api_key = self.api_key
        else:
            logger.warning("RESEND_API_KEY not configured - email notifications disabled")
    
    async def send_email(self, to_email: str, subject: str, content: str) -> DeliveryResult:
        """Send email via Resend API"""
        if not self.api_key:
            return DeliveryResult(success=False, error_message="Email service not configured", permanent_failure=True)
        
        try:
            await self.rate_limiter.wait_for_slot()
            
            params = {
                "from": self.from_email,
                "to": [to_email],
                "subject": subject,
                "html": content.replace("\n", "<br>")  # Simple HTML formatting
            }
            
            # For demo purposes, simulate API call
            if self.api_key.startswith('demo'):
                # Mock successful response for demo
                logger.info(f"DEMO: Email would be sent to {to_email}")
                logger.info(f"DEMO: Subject: {subject}")
                logger.info(f"DEMO: Content preview: {content[:100]}...")
                return DeliveryResult(success=True, message_id="demo_msg_123")
            
            # Real API call (requires proper setup)
            response = resend.Emails.send({
                "from": self.from_email,
                "to": [to_email], 
                "subject": subject,
                "html": content.replace("\n", "<br>")
            })
            
            if hasattr(response, 'id'):
                logger.info(f"Email sent successfully to {to_email}, message_id: {response.id}")
                return DeliveryResult(success=True, message_id=response.id)
            else:
                logger.error(f"Email send failed to {to_email}: Unexpected response format")
                return DeliveryResult(success=False, error_message="Unexpected response format")
                
        except Exception as e:
            error_msg = str(e)
            logger.error(f"Email send error to {to_email}: {error_msg}")
            
            # Check for rate limiting
            if "rate limit" in error_msg.lower():
                return DeliveryResult(success=False, error_message="Rate limited", retry_after=60)
            
            # Check for permanent failures
            permanent_failures = ["invalid email", "bounced", "blocked", "unsubscribed"]
            is_permanent = any(failure in error_msg.lower() for failure in permanent_failures)
            
            return DeliveryResult(
                success=False, 
                error_message=error_msg, 
                permanent_failure=is_permanent
            )


class WhatsAppService:
    """WhatsApp service using WhatsApp Cloud API"""
    
    def __init__(self):
        self.access_token = os.getenv("WHATSAPP_ACCESS_TOKEN")
        self.phone_number_id = os.getenv("WHATSAPP_PHONE_NUMBER_ID")
        self.base_url = f"https://graph.facebook.com/v18.0/{self.phone_number_id}"
        self.rate_limiter = RateLimiter(max_calls_per_minute=80)  # Conservative WhatsApp rate limit
        
        if not self.access_token or not self.phone_number_id:
            logger.warning("WhatsApp API credentials not configured - WhatsApp notifications disabled")
    
    def _format_phone_number(self, phone: str) -> str:
        """Format phone number for WhatsApp API (digits only)"""
        return "".join(c for c in phone if c.isdigit())
    
    async def send_whatsapp_message(self, to_phone: str, message: str) -> DeliveryResult:
        """Send WhatsApp message via Cloud API"""
        if not self.access_token or not self.phone_number_id:
            return DeliveryResult(success=False, error_message="WhatsApp service not configured", permanent_failure=True)
        
        try:
            # For demo purposes, simulate API call  
            if self.access_token and self.access_token.startswith('demo'):
                # Mock successful response for demo
                formatted_phone = self._format_phone_number(to_phone)
                logger.info(f"DEMO: WhatsApp would be sent to {formatted_phone}")
                logger.info(f"DEMO: Message: {message}")
                return DeliveryResult(success=True, message_id="demo_wa_123")
            
            await self.rate_limiter.wait_for_slot()
            
            formatted_phone = self._format_phone_number(to_phone)
            url = f"{self.base_url}/messages"
            
            headers = {
                "Authorization": f"Bearer {self.access_token}",
                "Content-Type": "application/json"
            }
            
            payload = {
                "messaging_product": "whatsapp",
                "to": formatted_phone,
                "type": "text",
                "text": {"body": message}
            }
            
            async with httpx.AsyncClient() as client:
                response = await client.post(url, json=payload, headers=headers, timeout=30)
            
            if response.status_code == 200:
                response_data = response.json()
                message_id = response_data.get("messages", [{}])[0].get("id")
                logger.info(f"WhatsApp message sent to {formatted_phone}, message_id: {message_id}")
                return DeliveryResult(success=True, message_id=message_id)
            elif response.status_code == 429:
                logger.warning(f"WhatsApp rate limited for {formatted_phone}")
                return DeliveryResult(success=False, error_message="Rate limited", retry_after=300)  # 5 minutes
            else:
                error_msg = f"WhatsApp API error: {response.status_code} - {response.text}"
                logger.error(error_msg)
                
                # Check for permanent failures
                permanent_status_codes = [400, 401, 403, 404]
                is_permanent = response.status_code in permanent_status_codes
                
                return DeliveryResult(
                    success=False,
                    error_message=error_msg,
                    permanent_failure=is_permanent
                )
                
        except asyncio.TimeoutError:
            logger.error(f"WhatsApp message timeout to {to_phone}")
            return DeliveryResult(success=False, error_message="Request timeout")
        except Exception as e:
            error_msg = str(e)
            logger.error(f"WhatsApp send error to {to_phone}: {error_msg}")
            return DeliveryResult(success=False, error_message=error_msg)
class NotificationService:
    """Main notification service orchestrating email and WhatsApp"""
    
    def __init__(self):
        self.email_service = EmailService()
        self.whatsapp_service = WhatsAppService()
        self.queue = NotificationQueue()
        self.templates = NotificationTemplates()
        self._processing_queue = False
    
    def _create_notification_context(self, complaint: Complaint, department: Department, **kwargs) -> NotificationContext:
        """Create notification context from complaint and department data"""
        location = complaint.address if complaint.address else f"GPS: {complaint.latitude}, {complaint.longitude}"
        if complaint.latitude is None and complaint.longitude is None:
            location = "Location not provided"
        
        # Calculate days overdue for escalations
        days_overdue = None
        if complaint.sla_deadline:
            now = datetime.now(timezone.utc)
            deadline = complaint.sla_deadline
            if deadline.tzinfo is None:
                deadline = deadline.replace(tzinfo=timezone.utc)
            if now > deadline:
                days_overdue = (now - deadline).days
        
        return NotificationContext(
            tracking_id=complaint.tracking_id,
            category=complaint.category,
            summary=complaint.summary,
            urgency_score=complaint.urgency_score,
            department_name=department.name,
            status=complaint.status,
            created_at=complaint.created_at,
            updated_at=complaint.updated_at,
            location=location,
            urgency_reasons=complaint.get_urgency_reasons(),
            sla_deadline=complaint.sla_deadline,
            days_overdue=days_overdue,
            **kwargs
        )
    
    def _detect_language(self, text: str) -> Language:
        """Detect language from text (simple heuristic)"""
        # Check for Urdu characters (simplified detection)
        urdu_chars = set('آأإاةبپتٹثجچحخدذرڑزژسشصضطظعغفقکگلمنوہیے')
        if any(char in urdu_chars for char in text):
            return Language.URDU
        return Language.ENGLISH
    
    async def create_notification_message(
        self, 
        recipient: str,
        channel: NotificationChannel,
        notification_type: NotificationType,
        context: NotificationContext,
        language: Optional[Language] = None
    ) -> NotificationMessage:
        """Create a formatted notification message"""
        
        if language is None:
            # Auto-detect language from complaint summary
            language = self._detect_language(context.summary)
        
        if channel == NotificationChannel.EMAIL:
            template = self.templates.get_email_template(notification_type, language)
            subject = self.templates.format_template(template.get("subject", "CivicFix Notification"), context)
            content = self.templates.format_template(template.get("content", "No template available"), context)
        elif channel == NotificationChannel.WHATSAPP:
            template = self.templates.get_whatsapp_template(notification_type, language)
            subject = f"CivicFix {notification_type.value}"
            content = self.templates.format_template(template, context)
        else:
            subject = f"CivicFix Notification - {context.tracking_id}"
            content = f"Notification for complaint {context.tracking_id}"
        
        return NotificationMessage(
            recipient=recipient,
            channel=channel,
            notification_type=notification_type,
            language=language,
            subject=subject,
            content=content,
            context=context
        )
    
    async def queue_notification(
        self,
        recipient: str,
        channel: NotificationChannel,
        notification_type: NotificationType,
        context: NotificationContext,
        language: Optional[Language] = None
    ) -> None:
        """Queue a notification for delivery"""
        message = await self.create_notification_message(
            recipient, channel, notification_type, context, language
        )
        await self.queue.enqueue(message)
        
        # Start processing if not already running
        if not self._processing_queue:
            asyncio.create_task(self._process_queue())
    
    async def _process_queue(self) -> None:
        """Process notification queue (background task)"""
        if self._processing_queue:
            return
        
        self._processing_queue = True
        logger.info("Started notification queue processing")
        
        try:
            while True:
                # Get ready messages
                ready_messages = await self.queue.get_ready_messages()
                
                for message in ready_messages:
                    try:
                        result = await self._send_message(message)
                        
                        if result.success:
                            logger.info(f"Notification sent successfully: {message.context.tracking_id} via {message.channel.value}")
                        elif result.permanent_failure:
                            logger.error(f"Permanent failure for {message.context.tracking_id}: {result.error_message}")
                        else:
                            # Retry logic
                            retry_delay = min(60 * (2 ** message.retry_count), 3600)  # Exponential backoff, max 1 hour
                            if result.retry_after:
                                retry_delay = result.retry_after
                            
                            await self.queue.requeue_for_retry(message, retry_delay)
                            logger.warning(f"Notification failed, requeued for retry: {message.context.tracking_id}")
                            
                    except Exception as e:
                        logger.error(f"Unexpected error processing notification: {e}")
                        await self.queue.requeue_for_retry(message)
                
                # Check for new messages every 5 seconds
                await asyncio.sleep(5)
                
        except Exception as e:
            logger.error(f"Queue processing error: {e}")
        finally:
            self._processing_queue = False
            logger.info("Stopped notification queue processing")
    
    async def _send_message(self, message: NotificationMessage) -> DeliveryResult:
        """Send notification message via appropriate channel"""
        try:
            if message.channel == NotificationChannel.EMAIL:
                return await self.email_service.send_email(
                    message.recipient, message.subject, message.content
                )
            elif message.channel == NotificationChannel.WHATSAPP:
                return await self.whatsapp_service.send_whatsapp_message(
                    message.recipient, message.content
                )
            else:
                return DeliveryResult(success=False, error_message=f"Unsupported channel: {message.channel}")
                
        except Exception as e:
            logger.error(f"Message send error: {e}")
            return DeliveryResult(success=False, error_message=str(e))
# Global notification service instance
_notification_service: Optional[NotificationService] = None

def get_notification_service() -> NotificationService:
    """Get singleton notification service instance"""
    global _notification_service
    if _notification_service is None:
        _notification_service = NotificationService()
    return _notification_service


# Main public API functions
async def send_complaint_notification(complaint: Complaint, dept: Department) -> None:
    """
    Send complaint notification to department via email and WhatsApp.
    
    Args:
        complaint: Complaint record
        dept: Department record with contact information
    """
    try:
        service = get_notification_service()
        context = service._create_notification_context(complaint, dept)
        
        # Send email notification
        if dept.email:
            await service.queue_notification(
                recipient=dept.email,
                channel=NotificationChannel.EMAIL,
                notification_type=NotificationType.SUBMISSION_CONFIRMATION,
                context=context
            )
        
        # Send WhatsApp notification if available
        if dept.whatsapp_contact:
            await service.queue_notification(
                recipient=dept.whatsapp_contact,
                channel=NotificationChannel.WHATSAPP,
                notification_type=NotificationType.SUBMISSION_CONFIRMATION,
                context=context
            )
        
        # Send urgent alert for high priority complaints
        if complaint.urgency_score >= 8:
            await send_urgent_alert(complaint, dept)
            
        logger.info(f"Queued complaint notifications for {complaint.tracking_id}")
        
    except Exception as e:
        logger.error(f"Error queueing complaint notification for {complaint.tracking_id}: {e}")
        # Don't re-raise - notifications should not block complaint processing


async def send_status_update_notification(complaint: Complaint, dept: Department, old_status: str) -> None:
    """
    Send status update notification to citizen and department.
    
    Args:
        complaint: Updated complaint record
        dept: Department record
        old_status: Previous status for context
    """
    try:
        service = get_notification_service()
        context = service._create_notification_context(
            complaint, dept
        )
        
        # Note: In a real implementation, we'd need citizen contact info
        # For now, just notify the department
        if dept.email:
            await service.queue_notification(
                recipient=dept.email,
                channel=NotificationChannel.EMAIL,
                notification_type=NotificationType.STATUS_UPDATE,
                context=context
            )
            
        logger.info(f"Queued status update notification for {complaint.tracking_id}")
        
    except Exception as e:
        logger.error(f"Error queueing status update for {complaint.tracking_id}: {e}")


async def send_escalation_notification(complaint: Complaint, dept: Department) -> None:
    """
    Send escalation alert to supervisor contacts.
    
    Args:
        complaint: Escalated complaint record
        dept: Department record with supervisor contact information
    """
    try:
        service = get_notification_service()
        context = service._create_notification_context(
            complaint, dept,
            escalation_reason="SLA deadline exceeded"
        )
        
        # Send to supervisor email if available
        if dept.supervisor_contact and "@" in dept.supervisor_contact:
            await service.queue_notification(
                recipient=dept.supervisor_contact,
                channel=NotificationChannel.EMAIL,
                notification_type=NotificationType.ESCALATION,
                context=context
            )
        
        # Send to supervisor WhatsApp if it's a phone number
        if dept.supervisor_contact and dept.supervisor_contact.startswith("+"):
            await service.queue_notification(
                recipient=dept.supervisor_contact,
                channel=NotificationChannel.WHATSAPP,
                notification_type=NotificationType.ESCALATION,
                context=context
            )
        
        # Also send to regular department contacts
        if dept.email:
            await service.queue_notification(
                recipient=dept.email,
                channel=NotificationChannel.EMAIL,
                notification_type=NotificationType.ESCALATION,
                context=context
            )
            
        if dept.whatsapp_contact:
            await service.queue_notification(
                recipient=dept.whatsapp_contact,
                channel=NotificationChannel.WHATSAPP,
                notification_type=NotificationType.ESCALATION,
                context=context
            )
        
        logger.info(f"Queued escalation notifications for {complaint.tracking_id}")
        
    except Exception as e:
        logger.error(f"Error queueing escalation notification for {complaint.tracking_id}: {e}")


async def send_urgent_alert(complaint: Complaint, dept: Department) -> None:
    """
    Send urgent alert for high priority complaints.
    
    Args:
        complaint: High priority complaint
        dept: Department record
    """
    try:
        service = get_notification_service()
        context = service._create_notification_context(complaint, dept)
        
        # Send urgent alerts via both email and WhatsApp
        if dept.email:
            await service.queue_notification(
                recipient=dept.email,
                channel=NotificationChannel.EMAIL,
                notification_type=NotificationType.URGENT_ALERT,
                context=context
            )
        
        if dept.whatsapp_contact:
            await service.queue_notification(
                recipient=dept.whatsapp_contact,
                channel=NotificationChannel.WHATSAPP,
                notification_type=NotificationType.URGENT_ALERT,
                context=context
            )
            
        # Also notify supervisor for urgent complaints
        if dept.supervisor_contact:
            if "@" in dept.supervisor_contact:  # Email
                await service.queue_notification(
                    recipient=dept.supervisor_contact,
                    channel=NotificationChannel.EMAIL,
                    notification_type=NotificationType.URGENT_ALERT,
                    context=context
                )
            elif dept.supervisor_contact.startswith("+"):  # Phone
                await service.queue_notification(
                    recipient=dept.supervisor_contact,
                    channel=NotificationChannel.WHATSAPP,
                    notification_type=NotificationType.URGENT_ALERT,
                    context=context
                )
        
        logger.info(f"Queued urgent alert notifications for {complaint.tracking_id}")
        
    except Exception as e:
        logger.error(f"Error queueing urgent alert for {complaint.tracking_id}: {e}")


async def send_completion_notification(complaint: Complaint, dept: Department) -> None:
    """
    Send completion notification when complaint is resolved.
    
    Args:
        complaint: Resolved complaint record
        dept: Department record
    """
    try:
        service = get_notification_service()
        context = service._create_notification_context(complaint, dept)
        
        # Note: In a real implementation, this would go to the citizen
        # For now, send confirmation to department
        if dept.email:
            await service.queue_notification(
                recipient=dept.email,
                channel=NotificationChannel.EMAIL,
                notification_type=NotificationType.COMPLETION,
                context=context
            )
            
        logger.info(f"Queued completion notification for {complaint.tracking_id}")
        
    except Exception as e:
        logger.error(f"Error queueing completion notification for {complaint.tracking_id}: {e}")


async def get_notification_stats() -> Dict[str, Any]:
    """Get notification service statistics"""
    try:
        service = get_notification_service()
        queue_size = len(service.queue.queue)
        failed_count = len(service.queue.failed_queue)
        
        return {
            "queue_size": queue_size,
            "failed_messages": failed_count,
            "processing": service._processing_queue,
            "email_configured": service.email_service.client is not None,
            "whatsapp_configured": bool(service.whatsapp_service.access_token)
        }
    except Exception as e:
        logger.error(f"Error getting notification stats: {e}")
        return {"error": str(e)}


# For testing and development
async def test_notification_integration():
    """Test notification service integration"""
    logger.info("Testing notification service integration...")
    
    try:
        service = get_notification_service()
        stats = await get_notification_stats()
        logger.info(f"Notification service stats: {stats}")
        
        # Test template formatting
        context = NotificationContext(
            tracking_id="CF-TEST",
            category="pothole",
            summary="Test complaint for integration testing",
            urgency_score=5,
            department_name="Test Department",
            status="Pending",
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc),
            location="Test Location"
        )
        
        template = NotificationTemplates.get_whatsapp_template(
            NotificationType.SUBMISSION_CONFIRMATION, 
            Language.ENGLISH
        )
        formatted = NotificationTemplates.format_template(template, context)
        logger.info(f"Sample formatted message: {formatted}")
        
        return True
        
    except Exception as e:
        logger.error(f"Notification integration test failed: {e}")
        return False


if __name__ == "__main__":
    # Quick test of the notification system
    asyncio.run(test_notification_integration())