import * as bcrypt from 'bcrypt';
import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuthService } from './auth.service';
import { User } from './entities/user.entity';

function user(overrides: Partial<User> = {}): User {
  const u = new User();
  u.id = 1;
  u.email = 'a@b.com';
  u.password = 'hashed';
  u.createdAt = new Date();
  u.updatedAt = new Date();
  u.deletedAt = new Date();
  return Object.assign(u, overrides);
}

describe('AuthService', () => {
  let service: AuthService;
  let repo: Repository<User>;
  let jwt: JwtService;

  beforeEach(async () => {
    const mockRepo = {
      findOne: jest.fn(),
      create: jest.fn((dto) => ({ ...dto, id: 1, createdAt: new Date(), updatedAt: new Date(), deletedAt: new Date() })),
      save: jest.fn((u) => Promise.resolve({ ...u, id: 1 })),
    };
    const mockJwt = {
      sign: jest.fn(() => 'fake-token'),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: getRepositoryToken(User), useValue: mockRepo },
        { provide: JwtService, useValue: mockJwt },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    repo = module.get(getRepositoryToken(User));
    jwt = module.get<JwtService>(JwtService);
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('saves a new user and returns it', async () => {
      (repo.findOne as jest.Mock).mockResolvedValue(null);
      (repo.save as jest.Mock).mockImplementation((u) => Promise.resolve({ ...u, id: 1 }));

      const out = await service.create({ email: 'new@test.com', password: 'secret123' });

      expect(out.email).toBe('new@test.com');
      expect(out.password).not.toBe('secret123');
      expect(repo.save).toHaveBeenCalled();
    });

    it('throws when email or password missing', async () => {
      await expect(service.create({ email: '', password: 'x' })).rejects.toThrow('email and password required');
      await expect(service.create({ email: 'x@x.com', password: '' })).rejects.toThrow('email and password required');
    });

    it('throws when email already exists', async () => {
      (repo.findOne as jest.Mock).mockResolvedValue(user({ email: 'taken@test.com' }));

      await expect(service.create({ email: 'taken@test.com', password: 'any' })).rejects.toThrow('User already exists');
    });
  });

  describe('login', () => {
    it('returns token and user when password matches', async () => {
      const hashed = await bcrypt.hash('mypass', 10);
      (repo.findOne as jest.Mock).mockResolvedValue(user({ email: 'u@test.com', password: hashed }));

      const out = await service.login({ email: 'u@test.com', password: 'mypass' });

      expect(out.token).toBe('fake-token');
      expect(out.user.email).toBe('u@test.com');
      expect(jwt.sign).toHaveBeenCalledWith(expect.objectContaining({ sub: 1, email: 'u@test.com' }), expect.any(Object));
    });

    it('throws when user not found', async () => {
      (repo.findOne as jest.Mock).mockResolvedValue(null);

      await expect(service.login({ email: 'nope@test.com', password: 'any' })).rejects.toThrow('User not found');
    });

    it('throws when password wrong', async () => {
      const hashed = await bcrypt.hash('right', 10);
      (repo.findOne as jest.Mock).mockResolvedValue(user({ email: 'u@test.com', password: hashed }));

      await expect(service.login({ email: 'u@test.com', password: 'wrong' })).rejects.toThrow('Invalid password');
    });

    it('throws when email or password missing', async () => {
      await expect(service.login({ email: '', password: 'x' })).rejects.toThrow('email and password required');
    });
  });

  describe('findById', () => {
    it('returns user when found', async () => {
      const u = user({ id: 42 });
      (repo.findOne as jest.Mock).mockResolvedValue(u);

      const out = await service.findById(42);

      expect(out?.id).toBe(42);
    });

    it('returns null when not found', async () => {
      (repo.findOne as jest.Mock).mockResolvedValue(null);

      const out = await service.findById(999);

      expect(out).toBeNull();
    });
  });
});
