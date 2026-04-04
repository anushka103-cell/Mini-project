const jwt = require("jsonwebtoken");
const { randomUUID } = require("crypto");

function createTokenService({
  accessSecret,
  refreshSecret,
  emailVerificationSecret,
  passwordResetSecret,
  issuer,
  audience,
  accessTokenTtl,
  refreshTokenTtl,
  emailVerificationTtl,
  passwordResetTtl,
}) {
  function issueAccessToken(user, sessionId) {
    return jwt.sign(
      {
        token_use: "access",
        sid: sessionId,
        ver: user.tokenVersion,
        role: user.role,
        anon_id: user.analyticsSubjectId,
        scope: ["patient:read", "patient:write"],
      },
      accessSecret,
      {
        algorithm: "HS512",
        audience,
        expiresIn: accessTokenTtl,
        issuer,
        jwtid: randomUUID(),
        subject: user.id,
      },
    );
  }

  function issueRefreshToken(user, sessionId) {
    return jwt.sign(
      {
        token_use: "refresh",
        sid: sessionId,
        ver: user.tokenVersion,
      },
      refreshSecret,
      {
        algorithm: "HS512",
        audience: `${audience}:refresh`,
        expiresIn: refreshTokenTtl,
        issuer,
        jwtid: randomUUID(),
        subject: user.id,
      },
    );
  }

  function issueEmailVerificationToken(userId) {
    return jwt.sign(
      {
        token_use: "email_verification",
      },
      emailVerificationSecret,
      {
        algorithm: "HS512",
        audience: `${audience}:verify-email`,
        expiresIn: emailVerificationTtl,
        issuer,
        jwtid: randomUUID(),
        subject: userId,
      },
    );
  }

  function verifyAccessToken(token) {
    const payload = jwt.verify(token, accessSecret, {
      algorithms: ["HS512"],
      audience,
      issuer,
    });

    if (payload.token_use !== "access") {
      throw new Error("Unexpected token type");
    }

    return payload;
  }

  function verifyRefreshToken(token) {
    const payload = jwt.verify(token, refreshSecret, {
      algorithms: ["HS512"],
      audience: `${audience}:refresh`,
      issuer,
    });

    if (payload.token_use !== "refresh") {
      throw new Error("Unexpected token type");
    }

    return payload;
  }

  function verifyEmailVerificationToken(token) {
    const payload = jwt.verify(token, emailVerificationSecret, {
      algorithms: ["HS512"],
      audience: `${audience}:verify-email`,
      issuer,
    });

    if (payload.token_use !== "email_verification") {
      throw new Error("Unexpected token type");
    }

    return payload;
  }

  function issuePasswordResetToken(userId) {
    return jwt.sign(
      {
        token_use: "password_reset",
      },
      passwordResetSecret,
      {
        algorithm: "HS512",
        audience: `${audience}:password-reset`,
        expiresIn: passwordResetTtl || "1h",
        issuer,
        jwtid: randomUUID(),
        subject: userId,
      },
    );
  }

  function verifyPasswordResetToken(token) {
    const payload = jwt.verify(token, passwordResetSecret, {
      algorithms: ["HS512"],
      audience: `${audience}:password-reset`,
      issuer,
    });

    if (payload.token_use !== "password_reset") {
      throw new Error("Unexpected token type");
    }

    return payload;
  }

  return {
    issueAccessToken,
    issueRefreshToken,
    issueEmailVerificationToken,
    issuePasswordResetToken,
    verifyAccessToken,
    verifyRefreshToken,
    verifyEmailVerificationToken,
    verifyPasswordResetToken,
  };
}

module.exports = {
  createTokenService,
};
