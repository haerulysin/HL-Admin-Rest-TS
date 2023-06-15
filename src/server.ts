import express, { Application, Express, Response, Request } from "express";
import cors from "cors";
import helmet from "helmet";
import bodyParser from "body-parser";
import { router } from "./router/router.js";
import passport from "passport";
import { fabricAPIKeyStrategy } from "./auth.js";

export default async function createServer(): Promise<Application> {
  const app: Express = express();
  if (process.env.NODE_ENV === "development") {
    app.use(cors());
  }

  if (process.env.NODE_ENV === "production") {
    app.use(helmet());
  }

  app.use(
    bodyParser.urlencoded({
      extended: false,
      parameterLimit: 100000,
      limit: "90mb",
    })
  );
  app.use(bodyParser.json({ limit: "90mb" }));

  //passport
  passport.use(fabricAPIKeyStrategy);
  app.use(passport.initialize())

  app.use("/api/v1", router);

  app.get("/", (req: Request, res: Response) => {
    res.send("HLVote Admin RestAPI");
  });

  app.listen(process.env.PORT, () => {
    console.log(
      `[Server] : Server is running on http://localhost:${process.env.PORT}`
    );
  });

  return app;
}
