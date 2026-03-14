export interface IPriceOracle {
  getPTPrice(market: string): Promise<bigint>;   // PT price in USDC (18 decimals)
  getYTPrice(market: string): Promise<bigint>;   // YT price in USDC (18 decimals)
  getSrNUSDPrice(): Promise<bigint>;             // srNUSD per USDC (18 decimals)
}
