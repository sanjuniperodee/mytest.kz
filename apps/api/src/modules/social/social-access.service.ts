import { Injectable, ForbiddenException } from "@nestjs/common";
import { PrismaService } from "../../database/prisma.service";
@Injectable()
export class SocialAccessService {
  constructor(private readonly db: PrismaService) {}
  async hidden(user: string) {
    const blocks = await this.db.socialBlock.findMany({
      where: { OR: [{ blockerId: user }, { blockedId: user }] },
    });
    return blocks.map((b) =>
      b.blockerId === user ? b.blockedId : b.blockerId,
    );
  }
  async allowed(user: string, other: string) {
    if ((await this.hidden(user)).includes(other))
      throw new ForbiddenException("Взаимодействие с пользователем недоступно");
  }
}
