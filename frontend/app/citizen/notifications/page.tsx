"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Bell, Check, ExternalLink, Loader2, Sparkles, AlertCircle } from "lucide-react";

interface NotificationItem {
  id: string;
  title: string;
  body: string;
  link?: string | null;
  readAt?: string | null;
  createdAt: string;
}

export default function CitizenNotificationsPage() {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchNotifications = () => {
    fetch("/api/notifications")
      .then((res) => res.json())
      .then((data) => {
        if (data.notifications) setNotifications(data.notifications);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    fetchNotifications();
  }, []);

  const markAsRead = async (id: string) => {
    try {
      await fetch(`/api/notifications/${id}/read`, { method: "PATCH" });
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, readAt: new Date().toISOString() } : n))
      );
    } catch {}
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-black text-slate-900 tracking-tight">Notifications</h1>
        <p className="text-xs text-slate-500">Live alerts for your complaints, worker dispatches and confirmations</p>
      </div>

      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-2xs space-y-3">
        {loading ? (
          <div className="py-12 text-center text-slate-400 text-xs">
            <Loader2 className="w-6 h-6 animate-spin mx-auto text-teal-600 mb-2" />
            <span>Loading notifications...</span>
          </div>
        ) : notifications.length === 0 ? (
          <div className="py-12 text-center text-slate-400 text-xs">
            <Bell className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p>You have no notifications right now.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {notifications.map((item) => {
              const isUnread = !item.readAt;
              return (
                <div
                  key={item.id}
                  className={`p-4 rounded-2xl border transition-all flex items-start justify-between gap-4 ${
                    isUnread
                      ? "bg-teal-50/50 border-teal-200 shadow-2xs"
                      : "bg-slate-50 border-slate-100 opacity-90"
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      {isUnread && (
                        <span className="w-2 h-2 rounded-full bg-[#0D7377] shrink-0" />
                      )}
                      <h4 className="text-sm font-bold text-slate-900">{item.title}</h4>
                      <span className="text-[10px] text-slate-400">
                        {new Date(item.createdAt).toLocaleString()}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed">{item.body}</p>
                    {item.link && (
                      <div className="pt-1">
                        <Link
                          href={item.link}
                          className="text-xs font-bold text-[#0D7377] hover:underline inline-flex items-center gap-1"
                        >
                          <span>Open Ticket</span>
                          <ExternalLink className="w-3 h-3" />
                        </Link>
                      </div>
                    )}
                  </div>

                  {isUnread && (
                    <button
                      onClick={() => markAsRead(item.id)}
                      className="p-1.5 rounded-xl hover:bg-teal-100 text-[#0D7377] text-xs font-bold shrink-0 transition-colors"
                      title="Mark as read"
                    >
                      <Check className="w-4 h-4" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
