include(BuildVeyonPlugin)

build_veyon_plugin(remotefilebrowser
	NAME RemoteFileBrowser
	SOURCES
	RemoteFileBrowserPlugin.cpp
	RemoteFileBrowserPlugin.h
	RemoteFileBrowserDialog.cpp
	RemoteFileBrowserDialog.h
	remotefilebrowser.qrc
	)

# Separate policy regression executable; never installed as a Veyon component.
add_executable(roomgoblin-pilot-policy-test PilotFilePolicyTest.cpp)
target_link_libraries(roomgoblin-pilot-policy-test PRIVATE Qt6::Core)
