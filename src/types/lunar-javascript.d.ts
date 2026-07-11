declare module 'lunar-javascript' {
  export class Lunar {
    getDayInGanZhiExact(): string;
    getDayGanExact(): string;
    getDayZhiExact(): string;
    getMonthInGanZhiExact(): string;
    getMonthZhiExact(): string;
    getYearInGanZhiExact(): string;
  }

  export class Solar {
    static fromDate(date: Date): Solar;
    getLunar(): Lunar;
  }
}
