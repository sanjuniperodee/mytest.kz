import { Module } from '@nestjs/common';
import { DbSnapshotService } from './db-snapshot.service';

@Module({
  providers: [DbSnapshotService],
})
export class DbSnapshotModule {}
