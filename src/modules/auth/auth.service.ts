import { ConflictException, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { LoginDto } from './dto/create-auth.dto';
import { UpdateAuthDto } from './dto/update-auth.dto';
import { AdminModel } from '../admin/models/admin.model';
import * as bcrypt from "bcrypt";
import { AdminService } from '../admin/admin.service';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { v4 as uuidv4 } from 'uuid';

import { UsersService } from '../users/users.service';
import { Transaction } from 'sequelize';
import { UsersModel } from '../users/models/users.model.';
import constants from 'src/common/utils/constants';

@Injectable()
export class AuthService {
 

  constructor(
    private readonly adminService: AdminService,
    private readonly configService: ConfigService,
    private readonly jwtService: JwtService,
    private readonly usersService: UsersService
  ){}

  async loginAdmin(data: LoginDto, client: string ){
    
    const { email, password } = data;

    let user = <AdminModel>{};

   

    if (client.toLowerCase() === 'admin') user = await this.adminService.findAdminByEmail(email);

    if (!user) throw new UnauthorizedException('Invalid login credentials'); 

    const comparePassword = bcrypt.compareSync(password, user.password);

    if (!comparePassword) throw new UnauthorizedException('Password is incorrect');

    if (!user.isEmailVerified) throw new ForbiddenException('Account deactivated, ensure to verify you account before login');

    if (!user.activated) throw new ForbiddenException("your account have been deactivated");

    const secret = this.configService.get<string>('secretKey');

    const accessToken = await this.jwtService.signAsync({ id: user.id, email, client, role: user.role }, { secret });

    const userData = user.toJSON();
    
    delete userData.password;
  
    return {
      ...userData,
      accessToken
    };
  }

  // A session counts as stale once it's older than ACTIVE_SESSION_TTL_SECONDS.
  // Covers logout never actually running - crash, cleared browser storage, a
  // failed network call, a frontend that (like ours did) never wired up the
  // logout endpoint. Without this, one of those would lock a paying user out
  // of their own account with no automatic way back in.
  private isActiveSessionStale(activeSessionCreatedAt: Date | null): boolean {
    if (!activeSessionCreatedAt) return true;

    const ageSeconds = (Date.now() - new Date(activeSessionCreatedAt).getTime()) / 1000;

    return ageSeconds > constants.SESSION.ACTIVE_SESSION_TTL_SECONDS;
  }

  async loginUser(data: LoginDto, client: string, transaction: Transaction){
   
    const { email, password } = data;

    let user = <UsersModel>{};

    if(client.toLowerCase() === 'user') user = await this.usersService.findUserByEmail(email);

    if (!user) throw new UnauthorizedException('Invalid login credentials'); 

    const comparePassword = bcrypt.compareSync(password, user.password);

    if (!comparePassword) throw new UnauthorizedException('Password is incorrect');

    if (!user.isEmailVerified) throw new ForbiddenException('email not yet verified, ensure to verify you account before login');

    if (!user.activated) throw new ForbiddenException("your account have been deactivated");

    // Only one active session allowed per account. If one is already set
    // AND it's still within its TTL, the account is genuinely logged in
    // elsewhere - refuse this login instead of silently kicking the other
    // session out. Uses ConflictException (409), not ForbiddenException
    // (403), so this case is distinguishable from "email not verified" /
    // "deactivated" on the client - those stay 403, this is 409.
    // If it's past its TTL, logout most likely never actually ran (crash,
    // cleared storage, a frontend bug) - self-heal by clearing it here
    // rather than leaving the account permanently locked out.
    if (user.activeSessionId) {
      if (!this.isActiveSessionStale(user.activeSessionCreatedAt)) {
        throw new ConflictException('This account is already logged in on another device. Please log out from there first.');
      }

      await this.usersService.clearActiveSession(user.id, transaction);
    }

    const sessionId = uuidv4();

    await this.usersService.setActiveSession(user.id, sessionId, transaction);

    const secret = this.configService.get<string>('secretKey');

    const accessToken = await this.jwtService.signAsync({ id: user.id, email, client, sessionId }, { secret, expiresIn: constants.SESSION.ACTIVE_SESSION_TTL_JWT });

    const userData = user.toJSON();
    
    delete userData.password;
  
    return {
      ...userData,
      accessToken
    };


  }


  async googleLogin(data: any, transaction: Transaction){
    
    const {email, fullName} = data;
    
    let user = <UsersModel>{};

     user = await this.usersService.findUserByEmail(email);

    if(!user) user = await this.usersService.createGoogleAccount(data, transaction);

    if (!user.activated) throw new ForbiddenException("your account have been deactivated");

    // Same single-active-session rule applies to Google sign-in - it's still
    // the same user account, just a different login route. Same
    // ConflictException (409) and same self-healing stale-session check as
    // loginUser, for the same reasons.
    if (user.activeSessionId) {
      if (!this.isActiveSessionStale(user.activeSessionCreatedAt)) {
        throw new ConflictException('This account is already logged in on another device. Please log out from there first.');
      }

      await this.usersService.clearActiveSession(user.id, transaction);
    }

    const sessionId = uuidv4();

    await this.usersService.setActiveSession(user.id, sessionId, transaction);

     const secret = this.configService.get<string>('secretKey');

     const client = "user";

    const accessToken = await this.jwtService.signAsync({ id: user.id, email, client, sessionId }, { secret, expiresIn: constants.SESSION.ACTIVE_SESSION_TTL_JWT });

    const userData = user.toJSON();
    
    delete userData.password;
  
    return {
      ...userData,
      accessToken
    };
  

   

  }

  // Frees the account up to log in again (this device or another) and, since
  // AuthGuard checks the token's sessionId against this on every request,
  // immediately invalidates the token being logged out - not just a
  // client-side formality.
  async logoutUser(userId: string, transaction: Transaction){
    await this.usersService.clearActiveSession(userId, transaction);
  }

}

