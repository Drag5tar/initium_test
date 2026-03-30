export const getRandomInt = (min: number, max: number) => {
  const minCeiled = Math.ceil(min);
  const maxFloored = Math.floor(max);
  return Math.floor(Math.random() * (maxFloored - minCeiled + 1) + minCeiled);
};

export const throttle = <T extends (...args: Parameters<T>) => unknown>(
  func: T,
  timeout: number,
): ((...args: Parameters<T>) => void) => {
  let timer: number | null = null;

  return function (...args: Parameters<T>) {
    if (timer) return;
    timer = setTimeout(() => {
      func(...args);
    }, timeout);
  };
};
