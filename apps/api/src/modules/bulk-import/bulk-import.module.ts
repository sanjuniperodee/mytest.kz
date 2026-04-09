import { Module } from '@nestjs/common';
import { BulkImportController } from './bulk-import.controller';
import { BulkImportService } from './bulk-import.service';
import { BulkImportGuard } from './guards/bulk-import.guard';
import { QuestionsModule } from '../questions/questions.module';

@Module({
  imports: [QuestionsModule],
  controllers: [BulkImportController],
  providers: [BulkImportService, BulkImportGuard],
})
export class BulkImportModule {}
