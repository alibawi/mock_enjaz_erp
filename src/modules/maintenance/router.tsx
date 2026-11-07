import { createRouterShim } from '../../shell/routerShim'

export * from 'react-router-dom'

export const MAINTENANCE_BASE = '/maintenance'
export const { Link, NavLink, Navigate, useNavigate, useLocation } = createRouterShim(MAINTENANCE_BASE)
