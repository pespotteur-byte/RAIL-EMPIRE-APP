# Cross-compile native Win7 32-bit prototype
CC = i686-w64-mingw32-gcc
CFLAGS = -O3 -march=i686 -mfpmath=sse -msse2 -Wall -pthread
LIBS = -lgdi32 -luser32 -lkernel32 -lpthread

TARGET = re-native.exe

all: $(TARGET)

$(TARGET): main.c
	$(CC) $(CFLAGS) -o $@ $< $(LIBS)

clean:
	rm -f $(TARGET)

.PHONY: all clean
