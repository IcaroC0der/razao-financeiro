type RateLimitRecord = {
  count: number;
  resetTime: number;
};

// Mapa em memória para controle de taxa por IP
const ipHits = new Map<string, RateLimitRecord>();

// Limpeza periódica de entradas expiradas para evitar vazamento de memória
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    for (const [key, value] of ipHits.entries()) {
      if (now > value.resetTime) {
        ipHits.delete(key);
      }
    }
  }, 5 * 60 * 1000); // a cada 5 minutos
}

/**
 * Verifica se a requisição excedeu o limite de tentativas no período.
 * @param ip Endereço IP do cliente
 * @param maxRequests Limite de tentativas no intervalo (padrão: 10)
 * @param windowMs Janela de tempo em milissegundos (padrão: 60.000 = 1 minuto)
 */
export function checkRateLimit(
  ip: string,
  maxRequests = 10,
  windowMs = 60 * 1000
): { success: boolean; remaining: number } {
  const now = Date.now();
  const record = ipHits.get(ip);

  if (!record || now > record.resetTime) {
    ipHits.set(ip, {
      count: 1,
      resetTime: now + windowMs,
    });
    return { success: true, remaining: maxRequests - 1 };
  }

  if (record.count >= maxRequests) {
    return { success: false, remaining: 0 };
  }

  record.count += 1;
  return { success: true, remaining: maxRequests - record.count };
}

/**
 * Obtém o IP do cliente de forma segura a partir dos cabeçalhos HTTP
 */
export function getClientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  const realIp = req.headers.get("x-real-ip");
  if (realIp) {
    return realIp.trim();
  }
  return "127.0.0.1";
}
