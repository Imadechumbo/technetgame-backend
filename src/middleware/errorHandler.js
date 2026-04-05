export function notFoundHandler(req, res) {
  res.status(404).json({
    ok: false,
    error: "Rota não encontrada"
  });
}

export function errorHandler(err, req, res, next) {
  console.error("[ERROR]", err);

  res.status(err.status || 500).json({
    ok: false,
    error: err.message || "Internal Server Error"
  });
}