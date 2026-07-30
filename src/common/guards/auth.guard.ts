import { BadRequestException, CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { ConfigService } from '@nestjs/config';
import { IS_LOGIN_KEY } from '../decorators/login.decorator';
import { IS_BYPASS_SESSION_CHECK_KEY } from '../decorators/bypass-session-check.decorator';
import { UsersService } from 'src/modules/users/users.service';



@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private jwtService: JwtService, 
    private reflector: Reflector,
    private configService: ConfigService,
    private usersService: UsersService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [context.getHandler(), context.getClass()]);

    const isLogin = this.reflector.getAllAndOverride<boolean>(IS_LOGIN_KEY, [context.getHandler(), context.getClass()]);

    const bypassSessionCheck = this.reflector.getAllAndOverride<boolean>(IS_BYPASS_SESSION_CHECK_KEY, [context.getHandler(), context.getClass()]);


    if (isPublic || isLogin) return true;

    const request = context.switchToHttp().getRequest();

    const token = request.headers['authorization'];

    const client = request.headers['client'];


    if (!token) throw new UnauthorizedException('Valid token is required');

    if (!client) throw new UnauthorizedException('Client is required');

    if (!['user', 'admin'].includes(client)) throw new UnauthorizedException('Invalid client');

    const _token = token.replace(/(Bearer\s|bearer\s)/, '');
    
   
    const privateKey = process.env.PRIVATE_KEY;
     
    let decoded: any;

    try {
      decoded = await this.jwtService.verifyAsync(_token, { secret: privateKey });
    } catch (err) {
      if (/Token/.test(err.name)) throw new UnauthorizedException('Invalid token');
      
      throw err;
    }

    // Single-active-session enforcement for paying user accounts: a token is
    // only good for as long as its sessionId still matches the account's
    // current one. It stops matching the moment the user logs out (cleared
    // to null) - old tokens can't keep working after that just because they
    // haven't expired.
    if (client.toLowerCase() === 'user' && !bypassSessionCheck) {
      const user = await this.usersService.findUserByEmail(decoded.email);

      if (!user || !decoded.sessionId || user["activeSessionId"] !== decoded.sessionId) {
        throw new UnauthorizedException('Session expired or logged in on another device. Please log in again.');
      }
    }

    request.user = decoded;

    return true;
  }
}