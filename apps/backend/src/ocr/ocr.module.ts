import { Global, Module } from '@nestjs/common';
import { BaiduOcrService } from './baidu-ocr.service';

@Global()
@Module({
  providers: [BaiduOcrService],
  exports: [BaiduOcrService],
})
export class OcrModule {}
