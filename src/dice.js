export function rollDice(count) {
  const results = [];
  for (let i = 0; i < count; i++) {
    results.push(Math.floor(Math.random() * 6) + 1);
  }
  return results;
}

export function interpretResults(results) {
  if (results.length === 0) {
    return { level: "failure", label: "0 or fewer dice — desperate" };
  }

  const sixes = results.filter((d) => d === 6).length;
  const fourPlus = results.filter((d) => d >= 4).length;

  if (sixes >= 2) {
    return { level: "critical", label: "Critical success" };
  }
  if (sixes === 1) {
    return { level: "full", label: "Full success" };
  }
  if (fourPlus >= 1) {
    return {
      level: "partial",
      label: "Partial success / success with complication",
    };
  }
  return { level: "failure", label: "Failure / worse position" };
}

export function fortuneRoll(pool) {
  const results = rollDice(Math.max(0, pool));
  const outcome = interpretResults(results);
  return { pool: Math.max(0, pool), results, outcome };
}
