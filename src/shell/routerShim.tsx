import { forwardRef, useCallback, useMemo } from 'react'
import {
  Link as RRLink, NavLink as RRNavLink, Navigate as RRNavigate, useLocation as rrUseLocation, useNavigate as rrUseNavigate,
  type LinkProps, type NavLinkProps, type NavigateFunction, type NavigateOptions, type NavigateProps, type To,
} from 'react-router-dom'

/**
 * Each module was written as a standalone app with absolute paths (`/contracts/new`, `/assets`, ...).
 * Mounted under a prefix, those paths must resolve inside the module. This shim re-implements the few
 * routing primitives that take a path so the module code stays untouched: absolute targets get the
 * module's base prepended, and `useLocation().pathname` has it stripped again.
 */
export function createRouterShim(base: string) {
  const withBase = (to: To): To => {
    if (typeof to === 'string') return to.startsWith('/') ? base + (to === '/' ? '' : to) : to
    return to.pathname?.startsWith('/') ? { ...to, pathname: base + (to.pathname === '/' ? '' : to.pathname) } : to
  }

  const Link = forwardRef<HTMLAnchorElement, LinkProps>(({ to, ...rest }, ref) => <RRLink ref={ref} to={withBase(to)} {...rest} />)
  Link.displayName = 'ModuleLink'

  const NavLink = forwardRef<HTMLAnchorElement, NavLinkProps>(({ to, ...rest }, ref) => <RRNavLink ref={ref} to={withBase(to)} {...rest} />)
  NavLink.displayName = 'ModuleNavLink'

  const Navigate = ({ to, ...rest }: NavigateProps) => <RRNavigate to={withBase(to)} {...rest} />

  function useNavigate(): NavigateFunction {
    const nav = rrUseNavigate()
    return useCallback(
      ((to: To | number, opts?: NavigateOptions) => (typeof to === 'number' ? nav(to) : nav(withBase(to), opts))) as NavigateFunction,
      [nav],
    )
  }

  function useLocation() {
    const loc = rrUseLocation()
    return useMemo(() => ({ ...loc, pathname: loc.pathname.startsWith(base) ? loc.pathname.slice(base.length) || '/' : loc.pathname }), [loc])
  }

  return { Link, NavLink, Navigate, useNavigate, useLocation }
}
