import { redirect } from "next/navigation";

export default function AdminSubscribersRedirect() {
  redirect("/admin/newsletter/subscribers");
}
