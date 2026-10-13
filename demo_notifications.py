"""
Demo script showing CivicFix AI Notification Service integration
with the complaint workflow.

This demonstrates how notifications are sent throughout the complaint lifecycle.
"""

import asyncio
import os
import sys
from datetime import datetime, timedelta, timezone

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")

# Set up demo environment (normally these would be in .env)
os.environ['RESEND_API_KEY'] = 'demo_key'  
os.environ['RESEND_FROM_EMAIL'] = 'demo@civicfix.ai'
os.environ['WHATSAPP_ACCESS_TOKEN'] = 'demo_token'
os.environ['WHATSAPP_PHONE_NUMBER_ID'] = '123456789'

from app.notify import (
    send_complaint_notification,
    send_urgent_alert, 
    send_escalation_notification,
    send_status_update_notification,
    get_notification_stats
)
from app.models import Complaint, Department
from app.config import ComplaintCategory, ComplaintStatus


def create_demo_complaint() -> Complaint:
    """Create a demo complaint for testing"""
    now = datetime.now(timezone.utc)
    return Complaint(
        id=1001,
        tracking_id="CF-1001",
        category=ComplaintCategory.POTHOLE.value,
        summary="Large pothole causing vehicle damage on Main Street",
        description="Deep pothole approximately 2 feet wide causing tire damage to vehicles. Located near the market intersection.",
        sentiment="negative",
        urgency_score=7,
        status=ComplaintStatus.PENDING.value,
        latitude=24.8607,
        longitude=67.0011,
        address="Main Street, Market Area, Karachi",
        created_at=now,
        updated_at=now,
        urgency_reasons='["Base severity: 5", "Weather bonus: +2"]',
        sla_deadline=now + timedelta(hours=72)
    )


def create_demo_department() -> Department:
    """Create a demo department for testing"""
    return Department(
        id=1,
        name="Roads Department",
        email="roads@municipality.gov",
        whatsapp_contact="+92-300-1234567",
        supervisor_contact="supervisor@municipality.gov"
    )


async def demo_complaint_lifecycle():
    """Demonstrate notification flow throughout complaint lifecycle"""
    
    print("🚀 CivicFix AI Notification Service Demo")
    print("=" * 50)
    
    complaint = create_demo_complaint()
    department = create_demo_department()
    
    print(f"📋 Demo Complaint: {complaint.tracking_id}")
    print(f"🏢 Department: {department.name}")
    print(f"⚡ Urgency Score: {complaint.urgency_score}/10")
    print()
    
    # 1. Initial complaint submission notification
    print("1️⃣  Sending complaint submission notification...")
    await send_complaint_notification(complaint, department)
    print("   ✅ Submitted - Confirmation sent to department")
    print()
    
    # 2. Check if urgent alert needed
    if complaint.urgency_score >= 8:
        print("2️⃣  Sending urgent alert...")
        await send_urgent_alert(complaint, department)
        print("   🚨 Urgent alert sent to department + supervisor")
    else:
        print("2️⃣  No urgent alert needed (score < 8)")
    print()
    
    # 3. Simulate status update  
    print("3️⃣  Simulating status update...")
    old_status = complaint.status
    complaint.status = ComplaintStatus.IN_PROGRESS.value
    complaint.updated_at = datetime.utcnow()
    
    await send_status_update_notification(complaint, department, old_status)
    print(f"   🔄 Status changed: {old_status} → {complaint.status}")
    print()
    
    # 4. Simulate SLA escalation
    print("4️⃣  Simulating SLA escalation...")
    complaint.escalated = True
    complaint.sla_deadline = datetime.utcnow() - timedelta(hours=1)  # Overdue by 1 hour
    
    await send_escalation_notification(complaint, department)
    print("   ⚠️  SLA escalation sent to supervisor")
    print()
    
    # 5. Show notification service stats
    print("5️⃣  Notification Service Statistics:")
    stats = await get_notification_stats()
    for key, value in stats.items():
        print(f"   {key}: {value}")
    print()
    
    print("✨ Demo completed! Check logs for detailed message content.")


async def demo_multilingual_templates():
    """Demonstrate multilingual template support"""
    
    print("\n🌐 Multilingual Template Demo")
    print("=" * 30)
    
    from app.notify import NotificationTemplates, NotificationContext, NotificationType, Language
    
    # Create sample context with Urdu content
    context_urdu = NotificationContext(
        tracking_id="CF-اردو-001",
        category="پانی کی لیکیج",
        summary="مین روڈ پر پانی کا پائپ پھٹ گیا ہے",
        urgency_score=8,
        department_name="Water & Sanitation",
        status="زیر التوا",
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
        location="کراچی، سندھ"
    )
    
    # English template
    english_template = NotificationTemplates.get_whatsapp_template(
        NotificationType.SUBMISSION_CONFIRMATION, Language.ENGLISH
    )
    english_msg = NotificationTemplates.format_template(english_template, context_urdu)
    
    # Urdu template  
    urdu_template = NotificationTemplates.get_whatsapp_template(
        NotificationType.SUBMISSION_CONFIRMATION, Language.URDU
    )
    urdu_msg = NotificationTemplates.format_template(urdu_template, context_urdu)
    
    print("📱 English WhatsApp Template:")
    print(f"   {english_msg}")
    print()
    
    print("📱 Urdu WhatsApp Template:")
    print(f"   {urdu_msg}")
    print()


async def demo_error_handling():
    """Demonstrate error handling capabilities"""
    
    print("\n🛡️  Error Handling Demo")
    print("=" * 25)
    
    # Create complaint with invalid department info
    complaint = create_demo_complaint() 
    bad_department = Department(
        id=999,
        name="Non-existent Department",
        email="invalid-email",  # Invalid email
        whatsapp_contact="invalid-phone"  # Invalid phone
    )
    
    print("🚫 Testing with invalid contact information...")
    
    # This should handle errors gracefully
    await send_complaint_notification(complaint, bad_department)
    
    print("   ✅ Errors handled gracefully - no crash!")
    print("   📊 Failed messages will be logged and retried appropriately")


async def main():
    """Run all demonstration scenarios"""
    try:
        # Main complaint lifecycle demo
        await demo_complaint_lifecycle()
        
        # Multilingual support demo
        await demo_multilingual_templates()
        
        # Error handling demo
        await demo_error_handling()
        
        print("\n🎉 All demos completed successfully!")
        print("\n📝 Note: This is a demo with mock API keys.")
        print("   In production, configure real API keys in .env file.")
        
    except Exception as e:
        print(f"\n❌ Demo failed with error: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    asyncio.run(main())