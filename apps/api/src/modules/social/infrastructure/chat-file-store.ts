import { Injectable } from "@nestjs/common";
import { mkdir, readFile, writeFile, unlink } from "fs/promises";
import { join, resolve } from "path";
import { objectStorage } from "../../../common/files/object-storage";

/**
 * Закрытые вложения чатов. С S3 (S3_* в окружении) — только в бакете под ключом private-chat-media/<id>, на диске не
 * хранятся; старый файл, оставшийся на диске с переезда, при первом чтении выкладывается в бакет и удаляется с диска.
 * Без S3 — папка CHAT_MEDIA_DIR, как раньше.
 */
@Injectable()
export class ChatFileStore {
  private readonly root = resolve(
    process.env.CHAT_MEDIA_DIR || join(process.cwd(), "private-chat-media"),
  );
  private path(id: string) {
    if (!/^[0-9a-f-]{36}$/i.test(id)) throw new Error("Invalid media id");
    return join(this.root, id);
  }
  private key(id: string) {
    this.path(id);
    return `private-chat-media/${id}`;
  }
  async put(id: string, bytes: Buffer) {
    const s3 = objectStorage();
    if (s3) {
      if (await s3.exists(this.key(id))) throw Object.assign(new Error("File exists"), { code: "EEXIST" });
      await s3.put(this.key(id), bytes);
      return;
    }
    await mkdir(this.root, { recursive: true, mode: 0o700 });
    await writeFile(this.path(id), bytes, { mode: 0o600, flag: "wx" });
  }
  /** Содержимое файла; null — файла нет. */
  async read(id: string): Promise<Buffer | null> {
    const s3 = objectStorage();
    const fromS3 = s3 ? await s3.get(this.key(id)) : null;
    if (fromS3) return fromS3;
    const local = await readFile(this.path(id)).catch(() => null);
    if (local && s3) {
      await s3.put(this.key(id), local);
      await unlink(this.path(id)).catch(() => {});
    }
    return local;
  }
  async remove(id: string) {
    await unlink(this.path(id)).catch(() => {});
    await objectStorage()?.delete(this.key(id)).catch(() => {});
  }
}
