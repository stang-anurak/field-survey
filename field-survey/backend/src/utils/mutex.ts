/** คิวเขียนข้อมูลแบบ in-process (ใช้ได้กับ Render instance เดียวเท่านั้น ดู docs/SECURITY.md) */
export class Mutex {
  #tail: Promise<void> = Promise.resolve();
  run<T>(fn: () => Promise<T>): Promise<T> {
    const p = this.#tail.then(() => fn());
    this.#tail = p.then(() => undefined, () => undefined);
    return p;
  }
}
