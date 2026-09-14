import { Injectable } from "@nestjs/common";
import { mkdir, writeFile, unlink } from "fs/promises";
import { join, resolve } from "path";
@Injectable()
export class ChatFileStore {
  private readonly root = resolve(
    process.env.CHAT_MEDIA_DIR || join(process.cwd(), "private-chat-media"),
  );
  path(id: string) {
    if (!/^[0-9a-f-]{36}$/i.test(id)) throw new Error("Invalid media id");
    return join(this.root, id);
  }
  async put(id: string, bytes: Buffer) {
    await mkdir(this.root, { recursive: true, mode: 0o700 });
    await writeFile(this.path(id), bytes, { mode: 0o600, flag: "wx" });
  }
  async remove(id: string) {
    await unlink(this.path(id)).catch(() => {});
  }
}
