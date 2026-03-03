import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { ChatbotContextCard } from "@/components/admin/ChatbotContextCard";
import { AdminChatTest, AdminChatSessionLogs } from "@/components/admin/AdminChatTest";

export default function AdminChatbotPage() {
  return (
    <div className="page-enter space-y-6">
      <AdminPageHeader title="Chatbot" />
      <ChatbotContextCard />
      <AdminChatTest />
      <AdminChatSessionLogs />
    </div>
  );
}
