import { ForbiddenException, Injectable } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { v2 as cloudinary } from 'cloudinary';
import { EventAccessService } from '../events/event-access.service';

@Injectable()
export class MediaService {
  constructor(private readonly eventAccess: EventAccessService) {}

  // Organizers upload the flyer of a new event; the flyer of an existing one,
  // whoever can edit its info (a co-organizer with any account included).
  async presign(userId: string, role: UserRole, eventId?: string) {
    if (eventId) {
      await this.eventAccess.assertCan(eventId, userId, 'EDIT_EVENT');
    } else if (role !== 'ORGANIZER' && role !== 'ADMIN') {
      throw new ForbiddenException(
        'Solo los organizadores pueden subir flyers',
      );
    }
    return this.generateSignature();
  }

  private generateSignature() {
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
  }
}
