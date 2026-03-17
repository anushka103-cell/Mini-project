app.post("/api/verify-email", (req, res) => {
  const { token } = req.body;

  if (!token) {
    return res.status(400).json({
      message: "Verification token missing",
    });
  }

  try {
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || "supersecretkey",
    );

    const user = users.find(
      (u) => u.email === decoded.email && u.verificationToken === token,
    );

    if (!user) {
      return res.status(400).json({
        message: "Invalid verification token",
      });
    }

    user.isVerified = true;
    user.verificationToken = null;

    res.json({
      message: "Email verified successfully",
    });
  } catch (error) {
    res.status(400).json({
      message: "Invalid or expired token",
    });
  }
});
