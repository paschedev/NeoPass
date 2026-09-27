import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { v2 as cloudinary } from 'cloudinary';

@Injectable()
export class MediaService {
  generateSignature() {
    try {
      const timestamp = Math.round(new Date().getTime() / 1000);
      const config = cloudinary.config();

      // Cloudinary requiere firmar los parametros que enviemos.
      // Firmamos con el timestamp y el preset usando el api_secret cargado de CLOUDINARY_URL.
      const signature = cloudinary.utils.api_sign_request(
        {
          timestamp: timestamp,
          upload_preset: 'neopass_flyers',
        },
        config.api_secret as string,
      );

      return {
        timestamp,
        signature,
        cloudName: config.cloud_name,
        apiKey: config.api_key,
        uploadPreset: 'neopass_flyers',
      };
    } catch (error) {
      throw new InternalServerErrorException(
        'Error generando la firma de Cloudinary',
      );
    }
  }
}
