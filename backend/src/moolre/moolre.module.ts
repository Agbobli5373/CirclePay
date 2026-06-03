import { Global, Module } from '@nestjs/common'
import { MoolreService } from './moolre.service'

@Global()
@Module({
  providers: [MoolreService],
  exports: [MoolreService],
})
export class MoolreModule {}
