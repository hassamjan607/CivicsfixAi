# CivicFix AI Notification Service

## Overview

The notification service (`app/notify.py`) provides comprehensive email and WhatsApp messaging capabilities for the CivicFix AI complaint management system. It handles complaint notifications, status updates, escalation alerts, and urgent notifications with multilingual support, retry logic, and rate limiting.

## Key Features

### 🚀 **Multi-Channel Communication**
- **Email**: Via Resend API for reliable email delivery
- **WhatsApp**: Via WhatsApp Cloud API for instant messaging  
- **Extensible**: Easy to add SMS or other channels

### 🌐 **Localization Support**
- **Bilingual Templates**: English and Urdu support
- **Auto-Detection**: Automatically detects language from complaint text
- **Cultural Context**: Templates designed for municipal services

### ⚡ **Reliability & Performance**
- **Queuing System**: In-memory message queue with persistence
- **Retry Logic**: Exponential backoff with configurable limits
- **Rate Limiting**: Prevents API quota exhaustion
- **Error Handling**: Graceful degradation when services are unavailable

### 📱 **Message Types**
- **Submission Confirmation**: Immediate acknowledgment with tracking ID
- **Status Updates**: Progress notifications for citizens and departments
- **Urgent Alerts**: High-priority complaint notifications  
- **Escalation Notices**: SLA breach notifications to supervisors
- **Completion Confirmations**: Resolution notifications

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Notification Service                         │
├─────────────────────────────────────────────────────────────────┤
│  NotificationService (Orchestrator)                            │
│  ├── Templates (English/Urdu)                                  │
│  ├── Queue (Retry Logic)                                       │
│  ├── EmailService (Resend)                                     │
│  └── WhatsAppService (Cloud API)                               │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────┬─────────────────────┬─────────────────────┐
│   Email Channel     │   WhatsApp Channel  │   Future Channels   │
│   (Resend API)      │   (Cloud API)       │   (SMS, Push, etc)  │
└─────────────────────┴─────────────────────┴─────────────────────┘
```

## Configuration

### Environment Variables

```bash
# Email Service (Resend)
RESEND_API_KEY=your_resend_api_key_here
RESEND_FROM_EMAIL=noreply@civicfix.ai

# WhatsApp Service (Cloud API)
WHATSAPP_ACCESS_TOKEN=your_whatsapp_token_here
WHATSAPP_PHONE_NUMBER_ID=your_phone_number_id_here
WHATSAPP_VERIFY_TOKEN=your_verify_token_here
```

### Department Configuration

Department contact information is configured in `config.py`:

```python
DEPARTMENTS_DATA = [
    {
        "name": "Roads Department",
        "email": "roads@municipality.gov",
        "whatsapp_contact": "+92-300-1234567",
        "supervisor_contact": "+92-300-1234568"
    }
    # ... more departments
]
```

## Usage Examples

### Basic Complaint Notification

```python
from app.notify import send_complaint_notification
from app.models import Complaint, Department

# Send notification when complaint is submitted
await send_complaint_notification(complaint, department)
```

### Urgent Alert

```python
from app.notify import send_urgent_alert

# For high-priority complaints (score >= 8)
if complaint.urgency_score >= 8:
    await send_urgent_alert(complaint, department)
```

### Escalation Notification

```python
from app.notify import send_escalation_notification

# When SLA deadline is exceeded
if complaint.is_overdue():
    await send_escalation_notification(complaint, department)
```

### Status Update

```python
from app.notify import send_status_update_notification

# When complaint status changes
await send_status_update_notification(complaint, department, old_status)
```

## Message Templates

### English Template Example

```text
Subject: Complaint Submitted Successfully - CF-1234

Dear Citizen,

Thank you for reporting the issue to CivicFix AI.

Complaint Details:
- Tracking ID: CF-1234
- Category: Water Leak
- Description: Pipe burst on Main Street
- Location: Main Street, Downtown
- Urgency Score: 7/10
- Assigned Department: Water & Sanitation
- Status: Pending

Expected Response Time: 2024-01-16 10:00:00

You can track your complaint status anytime using the tracking ID.
We appreciate your contribution to improving our city's infrastructure.

Best regards,
CivicFix AI Team
```

### Urdu Template Example

```text
Subject: شکایت کامیابی سے داخل کر دی گئی - CF-1234

محترم شہری،

CivicFix AI میں مسئلہ رپورٹ کرنے کے لیے آپ کا شکریہ۔

شکایت کی تفصیلات:
- ٹریکنگ ID: CF-1234
- قسم: پانی کی لیکیج
- تفصیل: مین سٹریٹ پر پائپ پھٹ گیا
- مقام: مین سٹریٹ، ڈاون ٹاون
- فوری سطح: 7/10
- تفویض شدہ شعبہ: واٹر اینڈ سینیٹیشن
- حالت: زیر التوا

متوقع جوابی وقت: 2024-01-16 10:00:00

آپ اپنی شکایت کی حالت کسی بھی وقت ٹریکنگ ID استعمال کرکے چیک کر سکتے ہیں۔
ہمارے شہر کی بنیادی ڈھانچے کو بہتر بنانے میں آپ کی شراکت کی تقدیر کرتے ہیں۔

نیک تمنائیں،
CivicFix AI ٹیم
```

### WhatsApp Template Example

```text
✅ Complaint CF-1234 submitted successfully!
📋 Water Leak: Pipe burst on Main Street
🏢 Assigned to: Water & Sanitation  
⚡ Urgency: 7/10
📍 Track at: civicfix.ai
```

## Queue Management

The service includes a sophisticated queuing system:

### Message Queue Features

- **Automatic Retry**: Failed messages are retried with exponential backoff
- **Max Retries**: Configurable retry limits (default: 3 attempts)  
- **Permanent Failure Detection**: Invalid emails/phones are not retried
- **Rate Limiting**: Prevents API quota exhaustion
- **Background Processing**: Non-blocking message delivery

### Queue Status Monitoring

```python
from app.notify import get_notification_stats

# Get queue statistics
stats = await get_notification_stats()
print(f"Queue size: {stats['queue_size']}")
print(f"Failed messages: {stats['failed_messages']}")
print(f"Email configured: {stats['email_configured']}")
print(f"WhatsApp configured: {stats['whatsapp_configured']}")
```

## Error Handling

The service is designed to never block complaint processing:

### Graceful Degradation

```python
# If notification fails, complaint processing continues
try:
    await send_complaint_notification(complaint, dept)
except Exception as e:
    logger.error(f"Notification failed: {e}")
    # Complaint still gets processed and tracking ID returned
```

### Retry Logic

- **Temporary Failures**: Network issues, rate limits → retry
- **Permanent Failures**: Invalid contacts, blocked numbers → skip
- **Exponential Backoff**: 60s, 120s, 240s, then permanent failure

### Monitoring & Logging

All notification attempts are logged with structured logging:

```python
import logging
logger = logging.getLogger(__name__)

# Success
logger.info(f"Email sent successfully to {email}, message_id: {msg_id}")

# Failure  
logger.error(f"Email send error to {email}: {error_msg}")

# Retry
logger.warning(f"Notification failed, requeued for retry: {tracking_id}")
```

## Testing

Comprehensive test suite covers:

### Unit Tests

- Template formatting and localization
- Queue operations and retry logic  
- Rate limiting functionality
- Service initialization and configuration

### Integration Tests

- Email service with Resend API mocks
- WhatsApp service with Cloud API mocks
- End-to-end notification workflows
- Error handling scenarios

### Running Tests

```bash
# Run all notification tests
python -m pytest tests/test_notify.py -v

# Run specific test categories  
python -m pytest tests/test_notify.py::TestRateLimiter -v
python -m pytest tests/test_notify.py::TestNotificationTemplates -v
python -m pytest tests/test_notify.py::TestPublicAPI -v
```

## Performance Characteristics

### Rate Limits

- **Email (Resend)**: 100 requests/minute
- **WhatsApp (Cloud API)**: 80 requests/minute (conservative)
- **Automatic throttling**: Waits for available slots

### Message Processing

- **Queue processing**: Every 5 seconds
- **Retry delays**: 60s → 120s → 240s → permanent failure
- **Memory usage**: O(queue_size) - typically <1000 messages
- **Background tasks**: Non-blocking, async processing

## Integration with CivicFix AI

### Complaint Workflow Integration

The notification service integrates seamlessly with the complaint processing workflow:

1. **Complaint Submission** → Confirmation notification
2. **High Urgency Detection** → Urgent alert  
3. **Status Changes** → Progress updates
4. **SLA Breaches** → Escalation notices
5. **Resolution** → Completion confirmation

### Department Routing

Notifications are automatically routed based on complaint categories:

```python
# Automatic department assignment
category = complaint.category
dept_name = CATEGORY_TO_DEPARTMENT[category]
dept = get_department_by_name(dept_name)

# Send to appropriate contacts
await send_complaint_notification(complaint, dept)
```

## Security Considerations

### API Key Management

- All API keys stored in environment variables
- No keys logged or returned in responses  
- Secure credential handling in production

### Data Privacy

- No citizen PII in logs
- Anonymous mode support for sensitive complaints
- GDPR-compliant data handling

### Input Validation

- Template injection protection
- Phone number format validation  
- Email address validation
- Rate limiting prevents abuse

## Future Enhancements

### Planned Features

1. **SMS Integration**: Twilio SMS for broader reach
2. **Push Notifications**: Mobile app notifications  
3. **Email Templates**: Rich HTML templates with branding
4. **Delivery Tracking**: Read receipts and delivery confirmations
5. **Citizen Preferences**: Opt-in/opt-out per channel
6. **Advanced Analytics**: Notification effectiveness metrics

### Performance Improvements

1. **Persistent Queue**: Redis/PostgreSQL queue for reliability
2. **Batch Processing**: Bulk email/WhatsApp sending
3. **Template Caching**: Pre-compiled template performance
4. **Webhook Integration**: Real-time delivery status updates

## Troubleshooting

### Common Issues

1. **No notifications sent**: Check API keys in .env file
2. **Rate limiting errors**: Increase retry delays  
3. **Template formatting errors**: Verify context data completeness
4. **Queue backup**: Monitor failed message count

### Debug Mode

```python
import logging
logging.basicConfig(level=logging.DEBUG)

# Run with verbose logging
await send_complaint_notification(complaint, dept)
```

### Health Checks

```python
from app.notify import test_notification_integration

# Test service health
success = await test_notification_integration()
print(f"Service health: {'OK' if success else 'FAILED'}")
```

## Conclusion

The CivicFix AI notification service provides a robust, scalable, and multilingual communication platform that enhances citizen engagement and improves municipal service delivery. With built-in reliability features, comprehensive error handling, and extensive testing, it ensures that important municipal notifications reach their intended recipients effectively.

For additional support or feature requests, please refer to the project documentation or raise an issue in the repository.