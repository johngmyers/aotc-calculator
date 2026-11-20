import {cleanup, fireEvent, render, screen} from "@testing-library/react";
import {afterEach, describe, expect, it, vi} from "vitest";
import {createTranslator} from "../../src/ui/i18n.js";
import {SubjectToKiddieTax} from "../../src/ui/SubjectToKiddieTax.js";

const EN_US_MESSAGES = {
    ageLabel: "Age at end of tax year",
    ageBracketUnder18: "0-17",
    ageBracket18: "18",
    ageBracket19to23: "19-23",
    ageBracket24OrOlder: "24 or older",
    fullTimeStudentLabel:
        "Enrolled as a full-time student for at least one academic period beginning in the tax year",
    halfTimeStudentLabel:
        "Enrolled as a student at least half-time for at least 5 calendar months",
    hasLivingParentLabel: "At least one parent is living at end of tax year",
    earnedMoreThanHalfSupportLabel:
        "Earned income was more than half of their own support",
} as const;

const t = createTranslator(EN_US_MESSAGES);

afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
});

describe("SubjectToKiddieTax", () => {
    it("defaults to 19-23 with living parent and student checked and emits isSubject=true", () => {
        const onChange = vi.fn();
        render(
            <SubjectToKiddieTax
                t={t}
                filingStatus="single"
                onChange={onChange}
            />,
        );

        expect(
            screen.getByRole("radio", {
                name: EN_US_MESSAGES.ageBracket19to23,
                hidden: true,
            }),
        ).toBeChecked();

        const livingParentBox = screen.getByRole("checkbox", {
            name: EN_US_MESSAGES.hasLivingParentLabel,
            hidden: true,
        });
        const studentBox = screen.getByRole("checkbox", {
            name: EN_US_MESSAGES.halfTimeStudentLabel,
            hidden: true,
        });
        const supportBox = screen.getByRole("checkbox", {
            name: EN_US_MESSAGES.earnedMoreThanHalfSupportLabel,
            hidden: true,
        });

        expect(livingParentBox).toBeVisible();
        expect(livingParentBox).toBeChecked();
        expect(studentBox).toBeVisible();
        expect(studentBox).toBeChecked();
        expect(supportBox).toBeVisible();
        expect(supportBox).not.toBeChecked();
        expect(onChange).toHaveBeenLastCalledWith(true);
    });

    it("uses fullTimeStudentLabel when requireFullTimeStudent is true", () => {
        const onChange = vi.fn();
        render(
            <SubjectToKiddieTax
                t={t}
                filingStatus="hoh"
                requireFullTimeStudent
                onChange={onChange}
            />,
        );

        expect(
            screen.getByRole("checkbox", {
                name: EN_US_MESSAGES.fullTimeStudentLabel,
                hidden: true,
            }),
        ).toBeVisible();
        expect(
            screen.queryByRole("checkbox", {
                name: EN_US_MESSAGES.halfTimeStudentLabel,
                hidden: true,
            }),
        ).toBeNull();
    });

    it("hides living parent, student, and support rows for 24 or older and emits false", () => {
        const onChange = vi.fn();
        render(
            <SubjectToKiddieTax
                t={t}
                filingStatus="single"
                onChange={onChange}
            />,
        );

        fireEvent.click(
            screen.getByRole("radio", {
                name: EN_US_MESSAGES.ageBracket24OrOlder,
                hidden: true,
            }),
        );

        expect(
            screen.getByRole("checkbox", {
                name: EN_US_MESSAGES.hasLivingParentLabel,
                hidden: true,
            }),
        ).not.toBeVisible();
        expect(
            screen.getByRole("checkbox", {
                name: EN_US_MESSAGES.halfTimeStudentLabel,
                hidden: true,
            }),
        ).not.toBeVisible();
        expect(
            screen.getByRole("checkbox", {
                name: EN_US_MESSAGES.earnedMoreThanHalfSupportLabel,
                hidden: true,
            }),
        ).not.toBeVisible();
        expect(onChange).toHaveBeenLastCalledWith(false);
    });

    it("hides student row for age 18 while keeping living parent and support visible", () => {
        const onChange = vi.fn();
        render(
            <SubjectToKiddieTax
                t={t}
                filingStatus="single"
                onChange={onChange}
            />,
        );

        fireEvent.click(
            screen.getByRole("radio", {
                name: EN_US_MESSAGES.ageBracket18,
                hidden: true,
            }),
        );

        expect(
            screen.getByRole("checkbox", {
                name: EN_US_MESSAGES.hasLivingParentLabel,
                hidden: true,
            }),
        ).toBeVisible();
        expect(
            screen.getByRole("checkbox", {
                name: EN_US_MESSAGES.halfTimeStudentLabel,
                hidden: true,
            }),
        ).not.toBeVisible();
        expect(
            screen.getByRole("checkbox", {
                name: EN_US_MESSAGES.earnedMoreThanHalfSupportLabel,
                hidden: true,
            }),
        ).toBeVisible();
        expect(onChange).toHaveBeenLastCalledWith(true);
    });

    it("hides student and support rows for 0-17 and keeps isSubject true when living parent is checked", () => {
        const onChange = vi.fn();
        render(
            <SubjectToKiddieTax
                t={t}
                filingStatus="single"
                onChange={onChange}
            />,
        );

        fireEvent.click(
            screen.getByRole("radio", {
                name: EN_US_MESSAGES.ageBracketUnder18,
                hidden: true,
            }),
        );

        expect(
            screen.getByRole("checkbox", {
                name: EN_US_MESSAGES.hasLivingParentLabel,
                hidden: true,
            }),
        ).toBeVisible();
        expect(
            screen.getByRole("checkbox", {
                name: EN_US_MESSAGES.halfTimeStudentLabel,
                hidden: true,
            }),
        ).not.toBeVisible();
        expect(
            screen.getByRole("checkbox", {
                name: EN_US_MESSAGES.earnedMoreThanHalfSupportLabel,
                hidden: true,
            }),
        ).not.toBeVisible();
        expect(onChange).toHaveBeenLastCalledWith(true);
    });

    it("hides student and support rows when no parent is living and emits false", () => {
        const onChange = vi.fn();
        render(
            <SubjectToKiddieTax
                t={t}
                filingStatus="single"
                onChange={onChange}
            />,
        );

        const livingParentBox = screen.getByRole("checkbox", {
            name: EN_US_MESSAGES.hasLivingParentLabel,
            hidden: true,
        });
        fireEvent.click(livingParentBox);

        expect(livingParentBox).not.toBeChecked();
        expect(
            screen.getByRole("checkbox", {
                name: EN_US_MESSAGES.halfTimeStudentLabel,
                hidden: true,
            }),
        ).not.toBeVisible();
        expect(
            screen.getByRole("checkbox", {
                name: EN_US_MESSAGES.earnedMoreThanHalfSupportLabel,
                hidden: true,
            }),
        ).not.toBeVisible();
        expect(onChange).toHaveBeenLastCalledWith(false);

        fireEvent.click(livingParentBox);
        expect(livingParentBox).toBeChecked();
        expect(
            screen.getByRole("checkbox", {
                name: EN_US_MESSAGES.halfTimeStudentLabel,
                hidden: true,
            }),
        ).toBeVisible();
        expect(
            screen.getByRole("checkbox", {
                name: EN_US_MESSAGES.earnedMoreThanHalfSupportLabel,
                hidden: true,
            }),
        ).toBeVisible();
        expect(onChange).toHaveBeenLastCalledWith(true);
    });

    it("sets isSubject to false when earned income is more than half of own support", () => {
        const onChange = vi.fn();
        render(
            <SubjectToKiddieTax
                t={t}
                filingStatus="single"
                onChange={onChange}
            />,
        );

        const supportBox = screen.getByRole("checkbox", {
            name: EN_US_MESSAGES.earnedMoreThanHalfSupportLabel,
            hidden: true,
        });
        fireEvent.click(supportBox);

        expect(supportBox).toBeChecked();
        expect(onChange).toHaveBeenLastCalledWith(false);
    });

    it("hides controls and emits false for mfj while preserving state on return", () => {
        const onChange = vi.fn();
        const {rerender} = render(
            <SubjectToKiddieTax
                t={t}
                filingStatus="hoh"
                onChange={onChange}
            />,
        );

        fireEvent.click(
            screen.getByRole("radio", {
                name: EN_US_MESSAGES.ageBracket18,
                hidden: true,
            }),
        );
        const supportBox = screen.getByRole("checkbox", {
            name: EN_US_MESSAGES.earnedMoreThanHalfSupportLabel,
            hidden: true,
        });
        fireEvent.click(supportBox);
        expect(onChange).toHaveBeenLastCalledWith(false);

        rerender(
            <SubjectToKiddieTax
                t={t}
                filingStatus="mfj"
                onChange={onChange}
            />,
        );
        expect(
            screen.getByRole("radio", {
                name: EN_US_MESSAGES.ageBracket18,
                hidden: true,
            }),
        ).not.toBeVisible();
        expect(onChange).toHaveBeenLastCalledWith(false);

        rerender(
            <SubjectToKiddieTax
                t={t}
                filingStatus="mfs"
                onChange={onChange}
            />,
        );
        rerender(
            <SubjectToKiddieTax
                t={t}
                filingStatus="hoh"
                onChange={onChange}
            />,
        );

        expect(
            screen.getByRole("radio", {
                name: EN_US_MESSAGES.ageBracket18,
                hidden: true,
            }),
        ).toBeChecked();
        expect(
            screen.getByRole("checkbox", {
                name: EN_US_MESSAGES.earnedMoreThanHalfSupportLabel,
                hidden: true,
            }),
        ).toBeChecked();
        expect(onChange).toHaveBeenLastCalledWith(false);
    });

    it("hides the entire control when hidden prop is true", () => {
        const onChange = vi.fn();
        render(
            <SubjectToKiddieTax
                t={t}
                filingStatus="single"
                hidden
                onChange={onChange}
            />,
        );

        expect(
            screen.getByRole("radio", {
                name: EN_US_MESSAGES.ageBracket19to23,
                hidden: true,
            }),
        ).not.toBeVisible();
    });
});
