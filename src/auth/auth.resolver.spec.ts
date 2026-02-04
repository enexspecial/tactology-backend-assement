import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { AuthResolver } from './auth.resolver';
import { AuthService } from './auth.service';
import { User } from './entities/user.entity';

describe('AuthResolver', () => {
  let resolver: AuthResolver;
  let authService: AuthService;

  beforeEach(async () => {
    const mockRepo = {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    };
    const mockJwt = { sign: jest.fn(() => 'token') };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthResolver,
        AuthService,
        { provide: getRepositoryToken(User), useValue: mockRepo },
        { provide: JwtService, useValue: mockJwt },
      ],
    }).compile();

    resolver = module.get<AuthResolver>(AuthResolver);
    authService = module.get<AuthService>(AuthService);
  });

  it('is defined', () => {
    expect(resolver).toBeDefined();
  });

  it('signUp calls service.create with input', async () => {
    const input = { email: 'a@b.com', password: 'secret123' };
    jest.spyOn(authService, 'create').mockResolvedValue({ id: 1, email: input.email } as User);

    await resolver.signUp(input);

    expect(authService.create).toHaveBeenCalledWith(input);
  });

  it('signIn calls service.login with input', async () => {
    const input = { email: 'a@b.com', password: 'secret123' };
    jest.spyOn(authService, 'login').mockResolvedValue({ token: 't', user: { id: 1, email: input.email } } as any);

    await resolver.signIn(input);

    expect(authService.login).toHaveBeenCalledWith(input);
  });

  it('me returns the current user', () => {
    const u = { id: 1, email: 'u@test.com' } as User;
    expect(resolver.me(u)).toBe(u);
  });
});
