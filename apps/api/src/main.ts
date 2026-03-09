import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import helmet from "helmet";
import { AppModule } from "./app.module";

function IsAllowedOrigin(origin: string, allowedOrigins: string[]) {
  return allowedOrigins.includes(origin);
}

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix("api");
  app.use(helmet());
  const frontendOriginValue = process.env.FRONTEND_URL;
  const allowedOrigins =
    frontendOriginValue && frontendOriginValue.trim().length > 0
      ? frontendOriginValue
          .split(",")
          .map((origin) => origin.trim())
          .filter((origin) => origin.length > 0)
      : ["http://localhost:3001", "http://localhost:3002"];
  app.enableCors({
    origin: (origin, callback) => {
      if (!origin) {
        callback(null, true);
        return;
      }
      callback(null, IsAllowedOrigin(origin, allowedOrigins));
    },
    credentials: true
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true
    })
  );

  const port = Number(process.env.API_PORT ?? "3000");
  await app.listen(port);
}

void bootstrap();
