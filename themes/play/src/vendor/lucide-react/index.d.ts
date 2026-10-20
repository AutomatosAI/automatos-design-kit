// Types for the two vendored icons, as lucide-react 0.279.0 declares them (dist/lucide-react.d.ts).
import type { ForwardRefExoticComponent, RefAttributes, SVGProps } from 'react';

type SVGAttributes = Partial<SVGProps<SVGSVGElement>>;
type ComponentAttributes = RefAttributes<SVGSVGElement> & SVGAttributes;
export interface LucideProps extends ComponentAttributes {
    size?: string | number;
    absoluteStrokeWidth?: boolean;
}
export type LucideIcon = ForwardRefExoticComponent<LucideProps>;

export declare const ExternalLink: LucideIcon;
export declare const Search: LucideIcon;
