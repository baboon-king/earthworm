import { user } from '@earthworm/schema';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as argon2 from 'argon2';
import * as request from 'supertest';
import { createUser } from '../../../test/fixture/user';
import { cleanDB } from '../../../test/helper/utils';
import { AppModule } from '../../app/app.module';
import { appGlobalMiddleware } from '../../app/useGlobal';
import { endDB } from '../../common/db';
import { DB, DbType } from '../../global/providers/db.provider';

const createUserData = {
  username: '12345678900',
  password: '123456',
  nickname: 'test',
};

const userData = createUser();
const password = '123456';

describe('auth e2e', () => {
  let app: INestApplication;
  let db: DbType;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    appGlobalMiddleware(app);
    db = moduleFixture.get<DbType>(DB);

    await app.init();

    await cleanDB(db);
    await setupDBData(db);
  });

  afterEach(async () => {
    await cleanDB(db);
    await endDB();
    await app.close();
  });

  describe('signup', () => {
    it('should signup', async () => {
      await request(app.getHttpServer())
        .post('/auth/signup')
        .send({
          ...createUserData,
        })
        .expect(201)
        .expect(({ body }) => {
          expect(body).toEqual(
            expect.objectContaining({
              token: expect.any(String),
              user: expect.objectContaining({
                nickname: createUserData.nickname,
                username: createUserData.username,
              }),
            }),
          );
        });
    });

    it('should not signup with existed phone', async () => {
      await request(app.getHttpServer())
        .post('/auth/signup')
        .send({
          nickname: userData.nickname,
          username: userData.username,
          password,
        })
        .expect(400);
    });
  });

  describe('login', () => {
    it('should login', async () => {
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          username: userData.username,
          password,
        })
        .expect(201)
        .expect(({ body }) => {
          expect(body).toEqual(
            expect.objectContaining({
              token: expect.any(String),
              user: expect.objectContaining({
                nickname: userData.nickname,
                username: userData.username,
              }),
            }),
          );
        });
    });
  });

  it('get user info', async () => {
    // get token
    const res = await request(app.getHttpServer()).post('/auth/login').send({
      username: userData.username,
      password,
    });

    // get user info
    await request(app.getHttpServer())
      .get('/auth/userInfo')
      .set('Authorization', `Bearer ${res.body.token}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body).toEqual(
          expect.objectContaining({
            nickname: userData.nickname,
            username: userData.username,
          }),
        );
      });
  });
});

async function setupDBData(db: DbType) {
  await db.insert(user).values({
    ...userData,
    password: await argon2.hash(password),
  });
}
