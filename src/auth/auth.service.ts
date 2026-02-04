import * as bcrypt from 'bcrypt';
import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateAuthInput } from './dto/create-auth.input';
import { AuthPayload } from './dto/auth-payload.object';
import { User } from './entities/user.entity';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly jwtService: JwtService,
  ) {}

  async findById(id: number): Promise<User | null> {
    return this.userRepository.findOne({ where: { id } });
  }
  async create(createAuthInput: CreateAuthInput) {
    const { email, password } = createAuthInput;

    if (!email || !password) {
      throw new Error('email and password required');
    }
    const user = await this.userRepository.findOne({ where: { email } });
    if (user) {
      throw new Error('User already exists');
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = this.userRepository.create({ email, password: hashedPassword });

    return this.userRepository.save(newUser);
  }

  async login(loginInput: CreateAuthInput): Promise<AuthPayload> {
    const { email, password } = loginInput;
    if (!email || !password) {
      throw new Error('email and password required');
    }

    const user = await this.userRepository.findOne({ where: { email } });
    if (!user) {
      throw new Error('User not found');
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new Error('Invalid password');
    }

    const token = this.jwtService.sign(
      { sub: user.id, email: user.email },
      { expiresIn: '7d' },
    );
    return { token, user };
  }
}
