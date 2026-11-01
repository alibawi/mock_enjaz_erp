import { createRouterShim } from '../../shell/routerShim'

export * from 'react-router-dom'

export const CONTRACTS_BASE = '/contract-mgmt'
export const { Link, NavLink, Navigate, useNavigate, useLocation } = createRouterShim(CONTRACTS_BASE)
