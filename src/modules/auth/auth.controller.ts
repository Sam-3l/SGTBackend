import { Controller, Get, Post, Body, Patch, Param, Delete, HttpCode, Headers, UseGuards, Req, Res } from '@nestjs/common';
import { AuthService } from './auth.service';

import { UpdateAuthDto } from './dto/update-auth.dto';
import { ResponseMessage } from 'src/common/decorators/response-message.decorator';
import { LoginDto } from './dto/create-auth.dto';
import { TransactionParam } from 'src/common/decorators/transaction-param.decorator';
import { Transaction } from 'sequelize';
import { Login } from 'src/common/decorators/login.decorator';
import { AuthGuard } from '@nestjs/passport';
import { User } from 'src/common/decorators/user.decorator';
import { BypassSessionCheck } from 'src/common/decorators/bypass-session-check.decorator';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Login()
  @Post('login/admin')
  @ResponseMessage('Logged in successfully')
  @HttpCode(200)
  async loginAdmin(@Body() body: LoginDto, @Headers("client") client: string) {
    return await this.authService.loginAdmin(body, client);
  }

  @Login()
  @Post('login/user')
  @ResponseMessage('Logged in successfully')
  @HttpCode(200)
  async loginUser(@Body() body: LoginDto, @Headers("client") client: string, @TransactionParam() transaction: Transaction) {
    return await this.authService.loginUser(body, client, transaction);
  }

  @BypassSessionCheck()
  @Post('logout')
  @ResponseMessage('Logged out successfully')
  @HttpCode(200)
  async logout(@User('id') userId: string, @TransactionParam() transaction: Transaction) {
    return await this.authService.logoutUser(userId, transaction);
  }
  

  @Login()
  @Get('google')
  @UseGuards(AuthGuard('google'))
  @ResponseMessage('Logged in successfully')
  @HttpCode(200)
  googleLogin() {}


  @Login()
  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  async googleRedirect(@Req() req, @TransactionParam() transaction: Transaction) {
    
    return await this.authService.googleLogin(req.user, transaction);
     
  }

}