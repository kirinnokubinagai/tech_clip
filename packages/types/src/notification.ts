export type Notification = {
  id: string;
  userId: string;
  type: "new_article" | "new_follower" | "summary_ready" | "system";
  title: string;
  body: string;
  isRead: boolean;
  data: string | null;
  createdAt: string;
};
