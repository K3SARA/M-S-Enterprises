package com.msenterprises.distributor;

import android.Manifest;
import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothClass;
import android.bluetooth.BluetoothDevice;
import android.bluetooth.BluetoothSocket;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.print.PrintAttributes;
import android.print.PrintDocumentAdapter;
import android.print.PrintManager;
import android.util.Base64;
import androidx.core.app.ActivityCompat;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import java.io.OutputStream;
import java.lang.reflect.Method;
import java.util.Set;
import java.util.UUID;

@CapacitorPlugin(
    name = "BluetoothPrinter",
    permissions = {
        @Permission(
            alias = "bluetooth",
            strings = {
                Manifest.permission.BLUETOOTH,
                Manifest.permission.BLUETOOTH_ADMIN,
                Manifest.permission.BLUETOOTH_CONNECT,
                Manifest.permission.BLUETOOTH_SCAN
            }
        )
    }
)
public class BluetoothPrinterPlugin extends Plugin {

    // Standard Bluetooth Serial Port Profile (SPP) UUID used by ESC/POS thermal printers
    private static final UUID SPP_UUID = UUID.fromString("00001101-0000-1000-8000-00805F9B34FB");

    private BluetoothAdapter getBluetoothAdapter() {
        return BluetoothAdapter.getDefaultAdapter();
    }

    private boolean hasBluetoothPermission() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            return ActivityCompat.checkSelfPermission(getContext(), Manifest.permission.BLUETOOTH_CONNECT) == PackageManager.PERMISSION_GRANTED;
        }
        return true;
    }

    @PluginMethod
    public void isAvailable(PluginCall call) {
        BluetoothAdapter adapter = getBluetoothAdapter();
        JSObject ret = new JSObject();
        ret.put("supported", adapter != null);
        ret.put("enabled", adapter != null && adapter.isEnabled());
        ret.put("hasPermission", hasBluetoothPermission());
        call.resolve(ret);
    }

    @PluginMethod
    public void getPairedDevices(PluginCall call) {
        BluetoothAdapter adapter = getBluetoothAdapter();
        if (adapter == null) {
            call.reject("Bluetooth is not supported on this device.");
            return;
        }

        if (!adapter.isEnabled()) {
            call.reject("Bluetooth is turned off. Please turn on Bluetooth in settings.");
            return;
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && !hasBluetoothPermission()) {
            requestPermissionForAlias("bluetooth", call, "pairedDevicesCallback");
            return;
        }

        fetchPairedDevices(call, adapter);
    }

    @PermissionCallback
    private void pairedDevicesCallback(PluginCall call) {
        BluetoothAdapter adapter = getBluetoothAdapter();
        if (adapter == null) {
            call.reject("Bluetooth is not supported on this device.");
            return;
        }
        if (!hasBluetoothPermission()) {
            call.reject("Bluetooth Nearby Devices permission was not granted. Please allow in Android App Settings.");
            return;
        }
        fetchPairedDevices(call, adapter);
    }

    private void fetchPairedDevices(PluginCall call, BluetoothAdapter adapter) {
        try {
            Set<BluetoothDevice> pairedDevices = adapter.getBondedDevices();
            JSArray devArray = new JSArray();

            if (pairedDevices != null) {
                for (BluetoothDevice device : pairedDevices) {
                    JSObject devObj = new JSObject();
                    String name = device.getName();
                    String address = device.getAddress();

                    devObj.put("name", name != null ? name : "Unknown Device");
                    devObj.put("address", address != null ? address : "");

                    boolean isLikelyPrinter = false;
                    try {
                        BluetoothClass bClass = device.getBluetoothClass();
                        if (bClass != null) {
                            int major = bClass.getMajorDeviceClass();
                            if (major == BluetoothClass.Device.Major.IMAGING) {
                                isLikelyPrinter = true;
                            }
                        }
                    } catch (Exception ignored) {}

                    if (name != null) {
                        String lower = name.toLowerCase();
                        if (lower.contains("print") || lower.contains("pos") || lower.contains("mpt")
                                || lower.contains("rpp") || lower.contains("zj") || lower.contains("thermal")
                                || lower.contains("goojprt") || lower.contains("innerprinter")
                                || lower.contains("xp") || lower.contains("bluetooth") || lower.contains("80")
                                || lower.contains("58") || lower.contains("pp802") || lower.contains("pp-802")
                                || lower.contains("pp") || lower.contains("802")) {
                            isLikelyPrinter = true;
                        }
                    }

                    devObj.put("isPrinter", isLikelyPrinter);
                    devArray.put(devObj);
                }
            }

            JSObject res = new JSObject();
            res.put("devices", devArray);
            call.resolve(res);
        } catch (SecurityException se) {
            call.reject("Bluetooth permission denied: " + se.getMessage());
        } catch (Exception e) {
            call.reject("Error fetching paired Bluetooth devices: " + e.getMessage());
        }
    }

    @PluginMethod
    public void printBytes(PluginCall call) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && !hasBluetoothPermission()) {
            requestPermissionForAlias("bluetooth", call, "printBytesCallback");
            return;
        }
        doPrintBytes(call);
    }

    @PermissionCallback
    private void printBytesCallback(PluginCall call) {
        if (!hasBluetoothPermission()) {
            call.reject("Bluetooth Nearby Devices permission was not granted. Please allow in Android App Settings.");
            return;
        }
        doPrintBytes(call);
    }

    private void doPrintBytes(PluginCall call) {
        String address = call.getString("address");
        String bytesBase64 = call.getString("bytesBase64");

        if (address == null || address.isEmpty()) {
            call.reject("Printer Bluetooth MAC address is required.");
            return;
        }

        if (bytesBase64 == null || bytesBase64.isEmpty()) {
            call.reject("No receipt data provided to print.");
            return;
        }

        BluetoothAdapter adapter = getBluetoothAdapter();
        if (adapter == null || !adapter.isEnabled()) {
            call.reject("Bluetooth is turned off. Please turn on Bluetooth.");
            return;
        }

        // Run network/Bluetooth socket I/O on background thread to prevent UI freezing
        new Thread(() -> {
            BluetoothSocket socket = null;
            OutputStream outputStream = null;
            try {
                BluetoothDevice device = adapter.getRemoteDevice(address);
                if (device == null) {
                    call.reject("Bluetooth device not found for address: " + address);
                    return;
                }

                // Cancel discovery because it significantly slows down connection
                try {
                    adapter.cancelDiscovery();
                } catch (Exception ignored) {}

                // Try standard RFCOMM SPP socket
                try {
                    socket = device.createRfcommSocketToServiceRecord(SPP_UUID);
                    socket.connect();
                } catch (Exception socketEx) {
                    try {
                        if (socket != null) socket.close();
                    } catch (Exception ignored) {}

                    // Fallback using reflection for generic Chinese/OEM Bluetooth thermal printers (like PP802)
                    try {
                        Method m = device.getClass().getMethod("createRfcommSocket", new Class[]{int.class});
                        socket = (BluetoothSocket) m.invoke(device, 1);
                        if (socket != null) {
                            socket.connect();
                        }
                    } catch (Exception fallbackEx) {
                        call.reject("Could not establish connection with printer (" + (device.getName() != null ? device.getName() : "PP802") + "): " + socketEx.getMessage());
                        return;
                    }
                }

                if (socket == null || !socket.isConnected()) {
                    call.reject("Failed to connect to Bluetooth printer. Please check printer power and range.");
                    return;
                }

                outputStream = socket.getOutputStream();
                byte[] data = Base64.decode(bytesBase64, Base64.DEFAULT);

                // Send data in chunks of 256 bytes to prevent buffer overflow in small thermal printers
                int chunkSize = 256;
                for (int i = 0; i < data.length; i += chunkSize) {
                    int len = Math.min(chunkSize, data.length - i);
                    outputStream.write(data, i, len);
                    outputStream.flush();
                    try {
                        Thread.sleep(30);
                    } catch (InterruptedException ignored) {}
                }

                outputStream.flush();
                try {
                    Thread.sleep(300);
                } catch (InterruptedException ignored) {}

                JSObject res = new JSObject();
                res.put("success", true);
                res.put("message", "Printed successfully to " + (device.getName() != null ? device.getName() : "printer"));
                call.resolve(res);

            } catch (SecurityException se) {
                call.reject("Bluetooth permission denied: " + se.getMessage());
            } catch (Exception e) {
                call.reject("Print error: " + e.getMessage());
            } finally {
                try {
                    if (outputStream != null) outputStream.close();
                } catch (Exception ignored) {}
                try {
                    if (socket != null) socket.close();
                } catch (Exception ignored) {}
            }
        }).start();
    }

    @PluginMethod
    public void printRawBt(PluginCall call) {
        String bytesBase64 = call.getString("bytesBase64");
        if (bytesBase64 == null || bytesBase64.isEmpty()) {
            call.reject("No receipt data provided.");
            return;
        }

        try {
            Intent intent = new Intent(Intent.ACTION_VIEW);
            intent.setData(Uri.parse("rawbt:data:base64," + bytesBase64));
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);

            JSObject res = new JSObject();
            res.put("success", true);
            res.put("message", "Sent to RawBT Print Service");
            call.resolve(res);
        } catch (Exception e) {
            call.reject("RawBT is not installed or failed: " + e.getMessage());
        }
    }

    @PluginMethod
    public void printSystem(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            try {
                PrintManager printManager = (PrintManager) getActivity().getSystemService(Context.PRINT_SERVICE);
                if (printManager != null && getBridge() != null && getBridge().getWebView() != null) {
                    PrintDocumentAdapter printAdapter = getBridge().getWebView().createPrintDocumentAdapter("M&S Receipt");
                    printManager.print("M&S Receipt", printAdapter, new PrintAttributes.Builder().build());
                    JSObject res = new JSObject();
                    res.put("success", true);
                    call.resolve(res);
                } else {
                    call.reject("PrintManager or WebView not available.");
                }
            } catch (Exception e) {
                call.reject("System print failed: " + e.getMessage());
            }
        });
    }
}
