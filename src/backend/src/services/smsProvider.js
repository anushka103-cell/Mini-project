/**
 * SMS provider abstraction for OTP delivery.
 *
 * In development: logs OTP to console (no external service needed).
 * In production: dispatches via the configured provider (twilio / aws-sns).
 *
 * Set SMS_PROVIDER in .env to enable a real provider.
 */

const { NODE_ENV } = require("../config/env");

function createSmsProvider() {
  const provider = (process.env.SMS_PROVIDER || "console").toLowerCase();

  if (NODE_ENV !== "production" || provider === "console") {
    return {
      name: "console",
      async sendOtp(mobile, otp) {
        console.log(`[SMS-DEV] OTP for ${mobile}: ${otp}`);
        return { delivered: true };
      },
    };
  }

  if (provider === "twilio") {
    return createTwilioProvider();
  }

  if (provider === "aws-sns") {
    return createAwsSnsProvider();
  }

  console.warn(
    `Unknown SMS_PROVIDER "${provider}". Falling back to console provider.`,
  );
  return {
    name: "console",
    async sendOtp(mobile, otp) {
      console.log(`[SMS-FALLBACK] OTP for ${mobile}: ${otp}`);
      return { delivered: true };
    },
  };
}

function createTwilioProvider() {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = process.env.TWILIO_FROM_NUMBER;

  if (!accountSid || !authToken || !fromNumber) {
    throw new Error(
      "Twilio requires TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_FROM_NUMBER",
    );
  }

  return {
    name: "twilio",
    async sendOtp(mobile, otp) {
      const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
      const auth = Buffer.from(`${accountSid}:${authToken}`).toString("base64");

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);

      try {
        const res = await fetch(url, {
          method: "POST",
          headers: {
            Authorization: `Basic ${auth}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({
            To: mobile,
            From: fromNumber,
            Body: `Your MindSafe verification code is: ${otp}. Valid for 5 minutes.`,
          }),
          signal: controller.signal,
        });

        if (!res.ok) {
          const errBody = await res.text();
          console.error("Twilio SMS error:", errBody);
          return { delivered: false, error: errBody };
        }

        return { delivered: true };
      } finally {
        clearTimeout(timeout);
      }
    },
  };
}

function createAwsSnsProvider() {
  // AWS SDK v3 — requires @aws-sdk/client-sns
  let SNSClient, PublishCommand;
  try {
    ({ SNSClient, PublishCommand } = require("@aws-sdk/client-sns"));
  } catch {
    throw new Error(
      "AWS SNS provider requires @aws-sdk/client-sns. Install it with: npm install @aws-sdk/client-sns",
    );
  }

  const region = process.env.AWS_REGION || "us-east-1";
  const client = new SNSClient({ region });

  return {
    name: "aws-sns",
    async sendOtp(mobile, otp) {
      try {
        await client.send(
          new PublishCommand({
            PhoneNumber: mobile,
            Message: `Your MindSafe verification code is: ${otp}. Valid for 5 minutes.`,
            MessageAttributes: {
              "AWS.SNS.SMS.SMSType": {
                DataType: "String",
                StringValue: "Transactional",
              },
            },
          }),
        );
        return { delivered: true };
      } catch (err) {
        console.error("AWS SNS error:", err);
        return { delivered: false, error: err.message };
      }
    },
  };
}

module.exports = { createSmsProvider };
