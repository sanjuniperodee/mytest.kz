import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Alert,
  Button,
  Card,
  Drawer,
  Empty,
  Input,
  List,
  message,
  Popconfirm,
  Select,
  Space,
  Spin,
  Tabs,
  Tag,
  Typography,
} from "antd";
import { api } from "../api/client";

type Person = { firstName: string | null; lastName: string | null; id: string };
type Room = {
  id: string;
  key: string;
  title: string | null;
  archived: boolean;
  _count: { members: number; messages: number };
  members: { user: Person }[];
};
type Page<T> = { items: T[]; nextCursor: string | null };
type Attachment = { id: string; mime: string; name: string; size: number };
type ChatMessage = {
  id: string;
  body: string;
  author: Person;
  createdAt: string;
  deletedAt: string | null;
  attachment: Attachment | null;
};
const name = (p: Person) =>
  [p.firstName, p.lastName].filter(Boolean).join(" ") || p.id;
const roomName = (r: Room) =>
  r.title ||
  (r.key === "global"
    ? "Общий чат"
    : r.members.map((m) => name(m.user)).join(" ↔ "));

function ModerationMedia({ file }: { file: Attachment }) {
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(
    () => () => {
      if (url) URL.revokeObjectURL(url);
    },
    [url],
  );
  async function load() {
    setBusy(true);
    try {
      const { data } = await api.get(`/social/media/${file.id}`, {
        responseType: "blob",
      });
      setUrl(URL.createObjectURL(data));
    } catch {
      message.error("Вложение недоступно");
    } finally {
      setBusy(false);
    }
  }
  if (!url)
    return (
      <Button loading={busy} onClick={() => void load()}>
        Открыть вложение: {file.name}
      </Button>
    );
  return (
    <div style={{ maxWidth: 400, marginTop: 8 }}>
      {file.mime.startsWith("image/") ? (
        <img
          src={url}
          alt={file.name}
          style={{ maxWidth: "100%", maxHeight: 300 }}
        />
      ) : file.mime.startsWith("audio/") ? (
        <audio controls src={url} style={{ maxWidth: "100%" }} />
      ) : file.mime.startsWith("video/") ? (
        <video
          controls
          src={url}
          style={{ maxWidth: "100%", maxHeight: 300 }}
        />
      ) : null}
      <div>
        <a href={url} download={file.name}>
          {file.name} · {(file.size / 1024 / 1024).toFixed(1)} МБ
        </a>
      </div>
    </div>
  );
}
function RoomMessages({ room }: { room: Room }) {
  const [cursor, setCursor] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const { data, error, isLoading, refetch } = useQuery({
    queryKey: ["moderation-messages", room.id, cursor, q],
    queryFn: async () =>
      (
        await api.get<Page<ChatMessage>>(
          `/admin/social/rooms/${room.id}/messages`,
          { params: { cursor: cursor || undefined, q: q || undefined } },
        )
      ).data,
  });
  return (
    <Space direction="vertical" style={{ width: "100%" }}>
      <Input.Search
        placeholder="Поиск в сообщениях"
        allowClear
        onSearch={(value) => {
          setQ(value);
          setCursor(null);
        }}
      />
      <Alert
        type="info"
        message="Просмотр сообщений и вложений фиксируется в журнале модерации."
      />
      {error && (
        <Alert
          type="error"
          message="Не удалось загрузить сообщения"
          action={<Button onClick={() => void refetch()}>Повторить</Button>}
        />
      )}
      {isLoading && <Spin />}
      {data?.items.length === 0 && <Empty description="Сообщений нет" />}
      {data?.items.map((item) => (
        <Card
          key={item.id}
          size="small"
          title={name(item.author)}
          extra={new Date(item.createdAt).toLocaleString("ru-RU")}
        >
          <Typography.Paragraph
            style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}
          >
            {item.deletedAt ? <Tag>Удалено</Tag> : item.body}
          </Typography.Paragraph>
          {item.attachment && <ModerationMedia file={item.attachment} />}
          {!item.deletedAt && (
            <Popconfirm
              title="Удалить сообщение для участников?"
              onConfirm={async () => {
                setBusy(true);
                try {
                  await api.delete(
                    `/admin/social/rooms/${room.id}/messages/${item.id}`,
                  );
                  await refetch();
                } catch {
                  message.error("Не удалось удалить сообщение");
                } finally {
                  setBusy(false);
                }
              }}
            >
              <Button
                danger
                disabled={busy}
                size="small"
                style={{ marginTop: 12 }}
              >
                Удалить
              </Button>
            </Popconfirm>
          )}
        </Card>
      ))}
      <Space>
        {cursor && (
          <Button onClick={() => setCursor(null)}>К новым сообщениям</Button>
        )}
        {data?.nextCursor && (
          <Button onClick={() => setCursor(data.nextCursor)}>Ранее</Button>
        )}
      </Space>
    </Space>
  );
}
function RoomMembers({ id }: { id: string }) {
  const [cursor, setCursor] = useState<string | null>(null);
  const { data, error, isLoading } = useQuery({
    queryKey: ["moderation-members", id, cursor],
    queryFn: async () =>
      (
        await api.get<
          Page<{ user: Person; role: string; muted: boolean; banned: boolean }>
        >(`/admin/social/rooms/${id}/members`, { params: { cursor: cursor || undefined } })
      ).data,
  });
  return error ? (
    <Alert type="error" message="Не удалось загрузить участников" />
  ) : (
    <List
      loading={isLoading}
      dataSource={data?.items}
      footer={<Space>
        {cursor && <Button onClick={() => setCursor(null)}>В начало</Button>}
        {data?.nextCursor && <Button onClick={() => setCursor(data.nextCursor)}>Следующие</Button>}
      </Space>}
      renderItem={(m) => (
        <List.Item>
          <span>{name(m.user)}</span>
          <Space wrap>
            <Tag>{m.role}</Tag>
            {m.muted && <Tag color="orange">Без права писать</Tag>}
            {m.banned && <Tag color="red">Заблокирован</Tag>}
          </Space>
        </List.Item>
      )}
    />
  );
}
function RoomAudit({ id }: { id: string }) {
  const { data, error, isLoading } = useQuery({
    queryKey: ["moderation-audit", id],
    queryFn: async () =>
      (
        await api.get<
          {
            id: string;
            actorId: string;
            action: string;
            createdAt: string;
            targetId: string | null;
          }[]
        >(`/admin/social/rooms/${id}/audit`)
      ).data,
  });
  return error ? (
    <Alert type="error" message="Не удалось загрузить журнал" />
  ) : (
    <List
      loading={isLoading}
      dataSource={data}
      renderItem={(item) => (
        <List.Item>
          <div style={{ overflowWrap: "anywhere" }}>
            <strong>{item.action}</strong> ·{" "}
            {new Date(item.createdAt).toLocaleString("ru-RU")}
            <div>Администратор: {item.actorId}</div>
            {item.targetId && <div>Объект: {item.targetId}</div>}
          </div>
        </List.Item>
      )}
    />
  );
}
export function ChatModeration() {
  const [selected, setSelected] = useState<Room | null>(null);
  const [type, setType] = useState("all");
  const [q, setQ] = useState("");
  const [cursor, setCursor] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const { data, error, isLoading, refetch } = useQuery({
    queryKey: ["moderation-rooms", type, q, cursor],
    queryFn: async () =>
      (
        await api.get<Page<Room>>("/admin/social/rooms", {
          params: { type, q: q || undefined, cursor: cursor || undefined },
        })
      ).data,
  });
  return (
    <Space direction="vertical" style={{ width: "100%" }}>
      <Space wrap>
        <Select
          aria-label="Тип чатов"
          value={type}
          style={{ minWidth: 160 }}
          onChange={(value) => {
            setType(value);
            setCursor(null);
          }}
          options={[
            { value: "all", label: "Все чаты" },
            { value: "direct", label: "Личные" },
            { value: "group", label: "Групповые" },
            { value: "global", label: "Общий чат" },
          ]}
        />
        <Input.Search
          placeholder="Название группы или имя участника"
          allowClear
          onSearch={(value) => {
            setQ(value);
            setCursor(null);
          }}
          style={{ maxWidth: 360 }}
        />
      </Space>
      {error && (
        <Alert
          type="error"
          message="Не удалось загрузить чаты"
          action={<Button onClick={() => void refetch()}>Повторить</Button>}
        />
      )}
      <List
        loading={isLoading}
        dataSource={data?.items}
        renderItem={(room) => (
          <List.Item
            actions={[
              <Button key="open" onClick={() => setSelected(room)}>
                Открыть
              </Button>,
            ]}
          >
            <List.Item.Meta
              title={
                <span>
                  {roomName(room)} {room.archived && <Tag>Закрыт</Tag>}
                </span>
              }
              description={`${room._count.members} участников · ${room._count.messages} сообщений`}
            />
          </List.Item>
        )}
      />
      <Space>
        {cursor && <Button onClick={() => setCursor(null)}>В начало</Button>}
        {data?.nextCursor && (
          <Button onClick={() => setCursor(data.nextCursor)}>
            Следующие чаты
          </Button>
        )}
      </Space>
      <Drawer
        width={720}
        open={!!selected}
        onClose={() => setSelected(null)}
        title={selected ? roomName(selected) : ""}
        destroyOnClose
      >
        {selected && (
          <>
            <Popconfirm
              title={
                selected.archived
                  ? "Открыть чат для отправки сообщений?"
                  : "Закрыть чат для отправки сообщений?"
              }
              onConfirm={async () => {
                setBusy(true);
                try {
                  await api.post(
                    `/admin/social/rooms/${selected.id}/${selected.archived ? "reopen" : "close"}`,
                  );
                  setSelected({ ...selected, archived: !selected.archived });
                  await refetch();
                } catch {
                  message.error("Не удалось обновить чат");
                } finally {
                  setBusy(false);
                }
              }}
            >
              <Button danger={!selected.archived} loading={busy}>
                {selected.archived ? "Открыть чат" : "Закрыть чат"}
              </Button>
            </Popconfirm>
            <Tabs
              key={selected.id}
              destroyInactiveTabPane
              items={[
                {
                  key: "messages",
                  label: "Сообщения",
                  children: <RoomMessages room={selected} />,
                },
                {
                  key: "members",
                  label: "Участники",
                  children: <RoomMembers id={selected.id} />,
                },
                {
                  key: "audit",
                  label: "Журнал",
                  children: <RoomAudit id={selected.id} />,
                },
              ]}
            />
          </>
        )}
      </Drawer>
    </Space>
  );
}
