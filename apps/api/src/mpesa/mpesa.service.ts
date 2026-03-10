import { BadRequestException, Injectable } from '@nestjs/common';
import {
  MpesaProvider,
  MpesaProviderRequest,
} from './interfaces/mpesa-provider.interface';

@Injectable()
export class MpesaService implements MpesaProvider {
  createPayment(request: MpesaProviderRequest): Promise<never> {
    void request;
    throw new BadRequestException('MPESA is not supported in v1');
  }
}
