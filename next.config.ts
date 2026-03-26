import type { NextConfig } from "next"
import nextra from 'nextra'
 
const withNextra = nextra({ search: false })

const nextConfig: NextConfig = {
  output: 'export'
}
 
export default withNextra(nextConfig)