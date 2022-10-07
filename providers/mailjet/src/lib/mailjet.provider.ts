import {
  ChannelTypeEnum,
  CheckIntegrationResponseEnum,
  EmailEventStatusEnum,
  ICheckIntegrationResponse,
  IEmailEventBody,
  IEmailOptions,
  IEmailProvider,
  ISendMessageSuccessResponse,
} from "@novu/stateless";
import Client, { Email } from "node-mailjet";
import { MailjetResponse } from "./mailjet-response.interface";

const MAILJET_API_VERSION = "v3.1";

export class MailjetEmailProvider implements IEmailProvider {
  id = "mailjet";
  channelType = ChannelTypeEnum.EMAIL as ChannelTypeEnum.EMAIL;

  private mailjetClient: Email.Client;
  constructor(
    private config: {
      apiKey: string;
      apiSecret: string;
      from: string;
    },
  ) {
    this.mailjetClient = Client.connect(config.apiKey, config.apiSecret);
  }

  async sendMessage(
    options: IEmailOptions,
  ): Promise<ISendMessageSuccessResponse> {
    const send = this.mailjetClient.post("send", {
      version: MAILJET_API_VERSION,
    });
    const requestObject = {
      Messages: [
        {
          From: {
            Email: options.from || this.config.from,
          },
          To: [
            {
              Email: options.to,
            },
          ],
          Subject: options.subject,
          TextPart: options.text,
          HTMLPart: options.html,
          Attachments: options.attachments?.map((attachment) => ({
            ContentType: attachment.mime,
            Filename: attachment.name,
            Base64Content: attachment.file.toString("base64"),
          })),
        },
      ],
    };

    const response = (await send.request(requestObject)) as MailjetResponse;

    return {
      id: response.response.header["x-mj-request-guid"],
      date: response.response.header.date,
    };
  }

  async checkIntegration(
    options: IEmailOptions,
  ): Promise<ICheckIntegrationResponse> {
    return {
      success: true,
      message: "Integrated successfully!",
      code: CheckIntegrationResponseEnum.SUCCESS,
    };
  }

  parseEventBody(
    body: any | any[],
    identifier: string,
  ): IEmailEventBody | undefined {
    if (Array.isArray(body)) {
      body = body.find((item) => item.MessageID === identifier);
    }

    if (!body) {
      return undefined;
    }

    const status = this.getStatus(body.event);

    if (status === undefined) {
      return undefined;
    }

    return {
      status: status,
      date: new Date().toISOString(),
      externalId: body.MessageID,
      response: body.smtp_reply ? body.smtp_reply : "",
      row: body,
    };
  }

  private getStatus(event: string): EmailEventStatusEnum | undefined {
    switch (event) {
      case "sent":
        return EmailEventStatusEnum.DELIVERED;
      case "open":
        return EmailEventStatusEnum.OPENED;
      case "click":
        return EmailEventStatusEnum.CLICKED;
      case "bounce":
        return EmailEventStatusEnum.BOUNCED;
      case "blocked":
        return EmailEventStatusEnum.DROPPED;
    }
  }
}
