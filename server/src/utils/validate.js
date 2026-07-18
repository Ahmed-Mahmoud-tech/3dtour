// Route middleware: validate (and coerce/normalize) req.body against a zod
// schema. On failure it responds 400 with the first issue's message — a
// malformed body is always a client error, never a 500. On success req.body
// is replaced with the parsed (typed, stripped) data so controllers can trust it.
export const validateBody = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.body ?? {});
  if (!result.success) {
    const issue = result.error.issues[0];
    const where = issue.path.length ? `${issue.path.join('.')}: ` : '';
    return res.status(400).json({ message: `${where}${issue.message}` });
  }
  req.body = result.data;
  next();
};
