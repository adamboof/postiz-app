import { IsDefined, IsUrl } from 'class-validator';

export class UploadUrlDto {
  @IsUrl()
  @IsDefined()
  url: string;
} 