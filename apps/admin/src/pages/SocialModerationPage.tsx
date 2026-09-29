import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Alert,
  Button,
  Card,
  Empty,
  message,
  Popconfirm,
  Space,
  Spin,
  Typography,
  Tabs,
} from "antd";
import { ChatModeration } from "../components/ChatModeration";
import { api } from "../api/client";

type Report = {
  id: string;
  reason: string;
  createdAt: string;
  post: {
    id: string;
    body: string;
    deletedAt: string | null;
    author: { firstName: string | null; lastName: string | null };
  };
};
function PostReports() {
  const [busy, setBusy] = useState<string | null>(null);
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["social-reports"],
    queryFn: async () =>
      (await api.get<Report[]>("/admin/social/reports")).data,
  });
  async function action(path: string, id: string) {
    setBusy(id);
    try {
      await api.delete(path);
      await refetch();
      message.success("Готово");
    } catch {
      message.error("Не удалось сохранить решение. Повторите попытку.");
    } finally {
      setBusy(null);
    }
  }
  return (
    <Space direction="vertical" size="middle" style={{ width: "100%" }}>
      <Typography.Paragraph type="secondary">
        Жалобы на публикации и ответы. Сначала показаны самые ранние 100
        обращений; после обработки появятся следующие.
      </Typography.Paragraph>
      {isLoading && <Spin />}
      {error && (
        <Alert
          type="error"
          message="Не удалось загрузить жалобы"
          action={<Button onClick={() => void refetch()}>Повторить</Button>}
        />
      )}
      {data?.length === 0 && <Empty description="Нет жалоб на рассмотрении" />}
      {data?.map((report) => (
        <Card
          key={report.id}
          title={
            [report.post.author.firstName, report.post.author.lastName]
              .filter(Boolean)
              .join(" ") || "Участник"
          }
          extra={new Date(report.createdAt).toLocaleDateString("ru-RU")}
        >
          <Typography.Paragraph
            style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}
          >
            {report.post.deletedAt
              ? "Публикация уже удалена"
              : report.post.body}
          </Typography.Paragraph>
          <Alert
            type="warning"
            message={report.reason}
            style={{ marginBottom: 16 }}
          />
          <Space wrap>
            <Popconfirm
              title="Удалить публикацию из сообщества?"
              onConfirm={() =>
                action(`/admin/social/posts/${report.post.id}`, report.id)
              }
            >
              <Button danger disabled={!!busy} loading={busy === report.id}>
                Удалить публикацию
              </Button>
            </Popconfirm>
            <Button
              disabled={!!busy}
              onClick={() =>
                void action(`/admin/social/reports/${report.id}`, report.id)
              }
            >
              Отклонить жалобу
            </Button>
          </Space>
        </Card>
      ))}
    </Space>
  );
}

type MessageReport = {
  id: string;
  reason: string;
  createdAt: string;
  message: {
    id: string;
    roomId: string;
    body: string;
    deletedAt: string | null;
    attachment: { name: string; mime: string } | null;
    author: { firstName: string | null; lastName: string | null };
    room: { id: string; title: string | null; kind: string };
  };
};
function MessageReports() {
  const [busy, setBusy] = useState<string | null>(null);
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["social-message-reports"],
    queryFn: async () =>
      (await api.get<MessageReport[]>("/admin/social/message-reports")).data,
  });
  async function action(path: string, id: string) {
    setBusy(id);
    try {
      await api.delete(path);
      await refetch();
      message.success("Готово");
    } catch {
      message.error("Не удалось сохранить решение. Повторите попытку.");
    } finally {
      setBusy(null);
    }
  }
  const roomLabel = (room: MessageReport["message"]["room"]) =>
    room.kind === "global"
      ? "Глобальный чат"
      : room.kind === "group"
        ? `Группа «${room.title ?? ""}»`
        : "Личная переписка";
  return (
    <Space direction="vertical" size="middle" style={{ width: "100%" }}>
      <Typography.Paragraph type="secondary">
        Жалобы на сообщения в чатах. Сначала показаны самые ранние 100
        обращений. Удаление сообщения записывается в аудит комнаты.
      </Typography.Paragraph>
      {isLoading && <Spin />}
      {error && (
        <Alert
          type="error"
          message="Не удалось загрузить жалобы"
          action={<Button onClick={() => void refetch()}>Повторить</Button>}
        />
      )}
      {data?.length === 0 && <Empty description="Нет жалоб на рассмотрении" />}
      {data?.map((report) => (
        <Card
          key={report.id}
          title={
            [report.message.author.firstName, report.message.author.lastName]
              .filter(Boolean)
              .join(" ") || "Участник"
          }
          extra={`${roomLabel(report.message.room)} · ${new Date(report.createdAt).toLocaleDateString("ru-RU")}`}
        >
          <Typography.Paragraph
            style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}
          >
            {report.message.deletedAt
              ? "Сообщение уже удалено"
              : report.message.body ||
                (report.message.attachment
                  ? `Вложение: ${report.message.attachment.name}`
                  : "")}
          </Typography.Paragraph>
          <Alert
            type="warning"
            message={report.reason}
            style={{ marginBottom: 16 }}
          />
          <Space wrap>
            <Popconfirm
              title="Удалить сообщение из чата?"
              onConfirm={() =>
                action(
                  `/admin/social/rooms/${report.message.roomId}/messages/${report.message.id}`,
                  report.id,
                )
              }
            >
              <Button danger disabled={!!busy} loading={busy === report.id}>
                Удалить сообщение
              </Button>
            </Popconfirm>
            <Button
              disabled={!!busy}
              onClick={() =>
                void action(
                  `/admin/social/message-reports/${report.id}`,
                  report.id,
                )
              }
            >
              Отклонить жалобу
            </Button>
          </Space>
        </Card>
      ))}
    </Space>
  );
}

export function SocialModerationPage() {
  return (
    <Tabs
      items={[
        {
          key: "chats",
          label: "Все чаты и сообщения",
          children: <ChatModeration />,
        },
        {
          key: "reports",
          label: "Жалобы на публикации",
          children: <PostReports />,
        },
        {
          key: "message-reports",
          label: "Жалобы на сообщения",
          children: <MessageReports />,
        },
      ]}
    />
  );
}
