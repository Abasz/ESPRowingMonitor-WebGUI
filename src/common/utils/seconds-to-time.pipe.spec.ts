import { SecondsToTimePipe } from "./seconds-to-time.pipe";

describe("SecondsToTime pipe", (): void => {
    let sut: SecondsToTimePipe;
    beforeEach((): void => {
        sut = new SecondsToTimePipe();
    });

    it("should return empty string if input is undefined", (): void => {
        expect(sut.transform(undefined as unknown as number)).toBe("");
    });

    it("should return 'Infinity days' if input is Infinity", (): void => {
        expect(sut.transform(Infinity)).toBe("Infinity days");
    });

    it("should return empty string if input is NaN", (): void => {
        expect(sut.transform(NaN)).toBe("");
    });

    it("should return 0 if input is 0", (): void => {
        expect(sut.transform(0)).toBe("0");
    });
});
