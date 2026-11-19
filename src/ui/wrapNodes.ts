import {createElement, type HTMLAttributes, JSX, type ReactNode,} from "react";

type IntrinsicTag = keyof JSX.IntrinsicElements;

export function wrapNodes<TTag extends IntrinsicTag>(
    tag: TTag,
    props: (HTMLAttributes<HTMLElement> & Record<string, unknown>) | null,
    buildChildren: () => ReactNode[],
): ReactNode {
    return createElement(tag, props ?? undefined, ...buildChildren());
}
